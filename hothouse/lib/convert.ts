import { finished } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import util from "node:util";
import path from "node:path";
import { exec } from "node:child_process";

import { pdfToPng } from "pdf-to-png-converter";
import { logger } from "./logger";

const asyncExec = util.promisify(exec);

export async function convert(candidateId: string, file: any, type: string) {
  const url = file.url;
  const parsedUrl = new URL(url);
  let extension = parsedUrl.pathname.split(".").pop();
  let filename = `candidates/${candidateId}/${type}.${extension}`;

  const response = await fetch(url);

  if (!response.body) {
    throw new Error("No response body");
  }

  logger.debug("download: downloading", { filename });
  await finished(
    Readable.fromWeb(response.body).pipe(createWriteStream(filename)),
  );

  const pageFilenames: string[] = [];

  if (extension === "docx" || extension === "doc") {
    logger.debug("download: converting to pdf", { filename });
    const command = await asyncExec(
      `soffice --headless --convert-to pdf ${filename} --outdir ${path.dirname(
        filename,
      )}`,
    );
    if (command.stderr) {
      logger.error("download: soffice error", { command: command.stderr });
      return [];
    } else {
      extension = "pdf";
      filename = `candidates/${candidateId}/${type}.${extension}`;
      logger.debug("download: converted to pdf", { filename });
    }
  }

  if (extension === "pdf") {
    logger.debug("download: converting to png", { filename });
    const pages = await pdfToPng(filename, {
      viewportScale: 2.0,
      useSystemFonts: false,
      disableFontFace: true,
      verbosityLevel: 0,
    });
    for (let i = 0; i < pages.length; i++) {
      const pageFilename = `candidates/${candidateId}/${type}-${i}.png`;
      await fs.writeFile(pageFilename, pages[i].content);
      pageFilenames.push(pageFilename);
    }
  } else {
    logger.error("download: unknown file type", {
      candidateId,
      extension,
    });
    return [];
  }
  return pageFilenames;
}
