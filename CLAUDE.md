# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment Setup
- Requires Node.js with npm/yarn installed
- Uses SQLite database (`candidates.db`) for local storage
- Requires `GREENHOUSE_AUTH_KEY` environment variable for API access

## Common Commands
```bash
# Install dependencies
yarn install

# Download candidates for a specific job
GREENHOUSE_AUTH_KEY="YOUR-KEY" ./greenhouse.js download --job-id <job_id>

# List all candidates in database
GREENHOUSE_AUTH_KEY="YOUR-KEY" ./greenhouse.js list

# Rank candidates (mentioned in README but not implemented)
GREENHOUSE_AUTH_KEY="YOUR-KEY" ./greenhouse.js rank
```

## Architecture
This is a Node.js CLI tool for interfacing with Greenhouse ATS (Applicant Tracking System):

- **Main executable**: `greenhouse.js` - CLI interface using Commander.js
- **Data storage**: SQLite database (`candidates.db`) stores candidate metadata
- **File storage**: `candidates/` directory stores downloaded resume PDFs organized by candidate ID
- **API integration**: Greenhouse Harvest API v1 with Basic Auth

### Core Functionality
- Downloads candidate data and resumes from Greenhouse API
- Stores candidate metadata in SQLite with duplicate prevention
- Organizes resume files in directory structure by candidate ID
- Generates a score for candidates by judging the downloaded resume, using rules defined in CANDIDATE.md

### Data Flow
1. Fetches candidates from Greenhouse API by job ID
2. Checks for existing candidates in local database
3. Downloads detailed candidate information including attachments
4. Saves resume PDFs to local filesystem
5. Stores candidate metadata in SQLite database

The tool is designed for HR/recruiting workflows where bulk candidate data and resume collection is needed for analysis or ranking purposes.