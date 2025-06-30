# Greenhouse AI Tooling

This tool will download, parse, and rank all candidates for a particular job in Greenhouse. Useful for filtering out spam/duplicate/automated/AI-generated resumes and for spotlighting quality candidates for human review. This does NOT replace the need for a human being to carefully review applications, it just helps sort the enormous pile into a more reasonable pile.

### Usage:

Create a `.env` file with ANTHROPIC_API_KEY and GREENHOUSE_AUTH_KEY. The GREENHOUSE_AUTH_KEY must have Harbor and Candidates access.

    ./greenhouse.js <command>


### Download candidates and resumes:

    ./greenhouse.js download --job-id 2423423


### List

    ./greenhouse.js list


### Rank

    ./greenhouse.js rank


### Chat (Claude Code)

    ./greenhouse.js chat