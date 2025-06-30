# Greenhouse AI Tooling

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