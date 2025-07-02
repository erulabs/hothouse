# Greenhouse AI Tooling

This tool will download, parse, and rank all candidates for a particular job in Greenhouse. Useful for filtering out spam/duplicate/automated/AI-generated resumes and for spotlighting quality candidates for human review. This does NOT replace the need for a human being to carefully review applications, it just helps sort the enormous pile into a more reasonable pile.

### Installation

This tool requires `libreoffice` for converting docx resumes to images. Install with:

    brew install --cask libreoffice

Then install the application's nodejs deps:

    yarn

### Usage:

Create a `.env` file with ANTHROPIC_API_KEY and GREENHOUSE_AUTH_KEY. The GREENHOUSE_AUTH_KEY must have GET/Read access to "Harbor", "Candidates" and "Job Post" access.

    ./greenhouse.ts <command>

    ./greenhouse.ts --help


### Download candidates and resumes:

    ./greenhouse.ts download <job-id>


### List

    ./greenhouse.ts list


### Rank

    ./greenhouse.ts rank <job-id>

