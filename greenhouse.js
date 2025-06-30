#!/usr/bin/env node --env-file-if-exists=.env

const fs = require('fs/promises');
const { createWriteStream } = require('fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const Anthropic = require('@anthropic-ai/sdk');

const { pdfToPng} = require('pdf-to-png-converter');
const sqlite3 = require('sqlite3').verbose();
const { program } = require('commander');
const util = require('util');

const GREENHOUSE_AUTH_KEY = process.env.GREENHOUSE_AUTH_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GREENHOUSE_AUTH_KEY) {
    throw new Error('GREENHOUSE_AUTH_KEY is not set. You can create a .env file with the key.');
}
if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. You can create a .env file with the key.');
}

const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
});

const db = new sqlite3.Database('candidates.db');
const dbRun = util.promisify(db.run.bind(db));
const dbAll = util.promisify(db.all.bind(db));
const dbGet = util.promisify(db.get.bind(db));

function greenhouse(path) {
    return fetch(`https://harvest.greenhouse.io/v1/${path}`, {
        headers: {
            'Authorization': `Basic ${Buffer.from(GREENHOUSE_AUTH_KEY + ':').toString('base64')}`
        }
    });
}


async function downloadCandidates(jobId) {
    let page = 1
    while (true) {
        const candidates = await greenhouse(`candidates?job_id=${jobId}&page=${page}`);
        const candidatesJson = await candidates.json();
        if (candidatesJson.length === 0) {
            break;
        }
        for (const candidate of candidatesJson) {
            const candidateId = candidate.id;
            const candidateName = candidate.first_name + ' ' + candidate.last_name;
            
            const existingCandidate = await dbGet("SELECT * FROM candidates WHERE id = ?", [candidateId]);
            if (existingCandidate) {
                console.log('Skipping', { existingCandidate });
                continue;
            }

            const candidateDetails = await greenhouse(`candidates/${candidateId}`);
            const candidateDetailsJson = await candidateDetails.json();

            const attachments = candidateDetailsJson.applications[0].attachments;

            if (attachments.length > 0) {
                console.log('Inserting', {candidateId, candidateName, attachments});
                await dbRun("INSERT INTO candidates (id, name, attachments) VALUES (?, ?, ?)", [candidateId, candidateName, JSON.stringify(attachments)]);
                await fs.mkdir(`candidates/${candidateId}`, { recursive: true });
                const resume = attachments.find(a => a.type === 'resume');
                if (resume) {
                    const resumeUrl = resume.url;

                    const parsedUrl = new URL(resumeUrl);
                    const extension = parsedUrl.pathname.split('.').pop();

                    const filename = `candidates/${candidateId}/resume.${extension}`
                    const response = await fetch(resumeUrl);
                    await finished(Readable.fromWeb(response.body).pipe(createWriteStream(filename)));

                    if (extension === 'pdf') {
                        const pages = await pdfToPng(filename, {
                            verbosityLevel: 1,
                            viewportScale: 2.0,
                        });
                        for (let i = 0; i < pages.length; i++) {
                            await fs.writeFile(`candidates/${candidateId}/resume-${i}.png`, pages[i].content);
                        }
                    } else {
                        console.log('Cannot convert resume to png', { candidateId, candidateName, extension });
                    }
                }
            }
        }
        page++;
    }
}

async function setup () {
    await db.serialize();
    await dbRun("CREATE TABLE IF NOT EXISTS candidates (id INTEGER PRIMARY KEY, name TEXT, attachments TEXT)");
}

program
    .command('download')
    .option('--job-id <id>', 'The job id to download candidates from')
    .action(async (str, options) => {
        const jobId = options.jobId || 2952722;
        await setup();
        await downloadCandidates(jobId);
        await db.close();
    })

program
  .command('list')
  .action(async (str, options) => {
    await setup();
    const rows = await dbAll("SELECT * FROM candidates");
    console.log({rows});
    await db.close();
  })

program
  .command('rank')
  .action(async (str, options) => {
    await setup();
    const rows = await dbAll("SELECT * FROM candidates");
    console.log({rows});
    await db.close();
  })

program.parse(process.argv);


