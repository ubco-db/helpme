# HelpMe System

Main features:
- **Queues** that support in-person and virtual office hours and labs with instructors and teaching assistants
- **Chatbot** for real-time answers about course content and course questions
- **Asynchronous Questions** that allow students to ask questions outside of labs or office hours 
- Built for UBC but **supports other organizations** (for more information, contact Ramon Lawrence ramon.lawrence@ubc.ca)

Note: the new Chatbot feature has been integrated through a different API service that is not part of this queue system. 

## Installation
The easiest way to spin up the system is through Docker.

The Docker container uses an environment variable file that can be found [here](packages/server/.env.docker). This file should stay up to date within other environment variable files. Change the environment variables to match your environment.

The Docker image should only be used on cloud service or developer to verify the final changes in pull request; this is because API service's image needs to be rebuild when new code changes are made. Instead, follow the steps in this [section](#running-locally-outside-of-docker-container) if you constantly making changes to the API.

1. Set up your .env files (one in `packages/server` and one in `packages/app`) to match your environment. You can copy the `dev.env` (for `packages/app`) and `.env.docker` (for `packages/server`) files, rename them to `.env` and fill in the values. More details on the different enviroment variables and where you can get them are in the `ENVIRONMENT_VARIABLES.md` file in the root directory.

2. Start the database and api services within a Docker:

```bash
docker-compose build && docker-compose up
```

3. Visit the app at http://localhost:80 (or http://localhost)


## Developing

[Developing Guide](DEVELOPING.md)


## License
GPL-3.0

