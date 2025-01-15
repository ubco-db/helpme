# HelpMe System

Main features:
- **Queues** that support in-person and virtual office hours and labs with instructors and teaching assistants
  - Also supports "task questions" (aka Demos) which are when students ask to have some "tasks" checked off. Useful for labs that have multiple parts that need to be checked off by staff
- **Course Chatbot** for real-time answers about course content and course questions
  - For students, they get personalized responses based on the course content that was uploaded (with citations!)
  - For instructors, they get more control and can see what questions are asked and also edit/verify the answer in case the question gets answered again
- **Anytime Questions** that allow students to ask questions outside of labs or office hours 
  - The questions are initially answered by AI, which can then be reviewed and edited by instructors and TAs (great for large courses with lots of TAs since any TA can answer)
  - Instructors and TAs can then make the question public to allow other students to see it (good for commonly asked questions)
  - Basically like an Email 2.0
- Built for UBC but **supports other organizations** (for more information, contact Ramon Lawrence ramon.lawrence@ubc.ca)

Note: the new Chatbot feature has been integrated through a different API service that is not part of this queue system. 

## Installation
The easiest way to spin up the system is through Docker.

The Docker container uses an environment variable file that can be found [here](packages/server/.env.docker). This file should stay up to date within other environment variable files. Change the environment variables to match your environment.

The Docker image should only be used on cloud service or developer to verify the final changes in pull request; this is because API service's image needs to be rebuild when new code changes are made. Instead, follow the steps in this [section](#running-locally-outside-of-docker-container) if you constantly making changes to the API.

1. Set up your .env files (one in `packages/server` and one in `packages/app`) to match your environment. You can copy the `dev.env` (for `packages/frontend`) and `.env.docker` (for `packages/server`) files, rename them to `.env` and fill in the values. More details on the different environment variables and where you can get them are in the [ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) file in the docs directory.

2. Start the database and api services within a Docker:

```bash
docker-compose build && docker-compose up
```

3. Visit the app at http://localhost:80 (or http://localhost)


## Developing

[New Devs Start Here](docs/NEWDEVS_STARTHERE.md)
[Developing Guide](docs/DEVELOPING.md)

### Other docs

[What is each environmental variable?](docs/ENVIRONMENT_VARIABLES.md)
[TaskQuestions/Demos/Assignments/TaskProgress Help](docs/taskQuestions_Demos_Assignments_TaskProgress_help.md)
[Toggle Course Features Help](docs/toggle_course_features_help.md)
[Backfill Vs Migrations](packages/server/src/backfill/README.md)

## License
GPL-3.0

