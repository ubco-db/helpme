# Developing Guidelines

- [Developing Guidelines](#developing-guidelines)
  - [Installation to run locally](#installation-to-run-locally)
  - [Technologies](#technologies)
  - [File Structure](#file-structure)
  - [Developing](#developing)
    - [Running locally outside a Docker container](#running-locally-outside-a-docker-container)
    - [Running locally within a Docker container](#running-locally-within-a-docker-container)
    - [Database changes](#database-changes)
      - [Migrations](#migrations)
    - [Adding an API Route](#adding-an-api-route)
    - [Testing](#testing)
      - [All tests are failing locally](#all-tests-are-failing-locally)
    - [Installing new packages](#installing-new-packages)
  - [Code Formatting](#code-formatting)
  - [Tips](#tips)
  - [Testing the Production Environment](#testing-the-production-environment)
  - [Production](#production)
    - [Changelog](#changelog)
  - [Misc](#misc)

## Installation to run locally

1. [Get Docker](https://docs.docker.com/get-docker/) so we can automatically run and setup Postgres
2. Make sure you have [node](https://nodejs.org/en/download/), [yarn](https://classic.yarnpkg.com/en/docs/install), and [psql](https://blog.timescale.com/tutorials/how-to-install-psql-on-mac-ubuntu-debian-windows/) (or another program that lets you connect and view the database like [Beekeeper Studio](https://www.beekeeperstudio.io/get-community)) installed. 
  - `yarn -v` should be `1.x.x`. Do not get Yarn 2. Node should also be version 20.x.x. If it's not, install [nvm](https://github.com/nvm-sh/nvm)
3. Run `yarn install` in this directory to get dependencies
4. Run `yarn dev:db:up` to start the database via docker; `yarn dev:db:down` will stop it (this step might not be needed).
5. Change the environment variables to match your environment. 
  - You can find the required environment variables in the `.env.development` file in the `packages/server` directory. If you're new to `.env` files, basically create a new `.env` file in the same directory as `.env.development` and copy-paste all of the variables over
    - Note that if you have installed postgres before and you have changed the default postgres password, you may need to change the password from mysecretpassword to this password
    - If you are running the app in a Docker container (for production), you should instead use the `.env.docker` environment variable template in the `packages/server` directory. 
  - There is also a .env for the frontend (`dev.env`). Do just as you did and create a `.env` in `packages/frontend` and copy-paste all the variables from `dev.env` over.
  - For more details, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
6. Start the app in development with `yarn dev`
7. Visit the app at http://localhost:3000/dev and click the "seed" button to seed the database with dummy data. 
  - You may need to first create a `dev`, `test`, and `chatbot` database in your local postgres database (using psql or Beekeeper Studio). 
  - You can do this by running `CREATE DATABASE dev;`, `CREATE DATABASE test;`, and `CREATE DATABASE chatbot;` in psql.
8. Visit the app at http://localhost:3000
9. On the login page, you have access to the following dummy users (assuming the database is properly seeded):
   1.  Ramon@ubc.ca
   2.  StudentOne@ubc.ca
   3.  StudentTwo@ubc.ca
   4.  They all have the password of `seed`

If you have any questions, feel free to reach out to a member of the team. If you think this document can be improved, make a PR!

## Technologies

-   [Next.js](https://nextjs.org/docs/getting-started) lets us do server-side and client-side React rendering, as well as write backend API endpoints (though instead we opted for writing our own backend endpoints). So, we mostly only use it for the **frontend**.
    It also gives us developer ergonomics like hot reload in dev.
-   [Nest.js](https://nestjs.com/) runs our **backend** http api. It gives us controllers and services and other tools for making our API endpoints
-   [Typescript](https://www.typescriptlang.org/docs/home.html) lets us write maintainable, scalable Javascript
-   [Postgresql](https://www.postgresql.org/docs/11/index.html) is a very reliable and popular SQL database that is great for 99% of applications
-   [TypeORM](https://typeorm.io/) lets us query Postgres easily and with Typescript validating our schema.
-   [Docker](https://www.docker.com/products/docker-desktop) sets up a consistent Postgres + Redis environment on all developer's machines
-   [Redis](https://redis.io/) is used to enable 0 downtime deploy (what? who wrote this. It's used for caching frequently accessed data like questions)
    -   We are using @liaoliaots/nestjs-redis ([V8](https://github.com/liaoliaots/nestjs-redis/blob/f902b3dc904bf04e8b1f535789decfe11c1c5c37/docs/v8/redis.md)) and ioredis packages for allowing us to easily integrate it with our Nest.js backend
-   ~~[Cypress](https://www.cypress.io/)~~ is used for frontend E2E tests. Currently not being used.

## File Structure

Source code is in the `packages` folder.

For a nice visualization/description, see [NEWDEVS_STARTHERE.md](NEWDEVS_STARTHERE.md#codebase), but from a high level:

`frontend/app` is a the Next.js frontend. Routing is done using the file system. For example, the page `/courses/page.tsx` would be served at `domain.com/courses`. Pages are usually all rendered on the client side but can instead be rendered server-side with [server components](https://nextjs.org/docs/app/building-your-application/rendering/server-components). Data fetching usually happens on client-side by using the functions we make in `frontend/app/api/index.ts`. 

`frontend/app/api/index.ts` is a special frontend file that wraps network calls to the api in a neater, **type-safe** interface. Every backend route we have on the backend should have a corresponding function here (so if you make or change and endpoint, don't forget to modify the corresponding function here).

`server` is the server (backend) that runs the REST API and websockets. Each API route is controlled by a controller, module, and service. [Learn more](https://nestjs.com/)

`common` is where common code, globals, and types go. It is imported into the frontend and server.

The `infrastructure` folder is for docker and other deployment files. You can mostly ignore it.


## Developing

### Running locally outside a Docker container

Do `yarn dev`

### Running locally within a Docker container

Note: this section may be outdated?

Docker container uses a different environment variable file that can be found [here](packages/server/.env.docker). This file should stay up to date within other environment variable files.

The docker image should only be used on cloud service or developer to verify the final changes in pull request; this is because API service's image needs to be rebuild when new code changes are made. Instead, follow the steps in this [section](#running-locally-outside-of-docker-container) if you constantly making changes to the API.

1. Start the database and api services within a Docker:

```bash
docker-compose build && docker-compose up
```

2. Visit the app at http://localhost:80 (or http://localhost)

### Database changes

`table_name.entity.ts` files are used to define the database schema. 
`table_name.controller.ts` files are used to define the API routes for the table.
`table_name.service.ts` files are used to define the business logic for the table (basically like server-side-only functions).
`table_name.module.ts` files are used to define the module for the table. What is a module? It's a way to group together related entities, controllers, and services. It's a NestJS thing.

If you're creating a new `table_name.module.ts` file, you must also add it to the `app.module.ts` file 

Also, you must update the `seed.controller.ts` file to reflect the new database changes. This seed file is used to populate the database with dummy data on http://localhost:3000/dev.

#### Migrations

If you change an entity, you MUST run `yarn migration:generate ./migration/your-migration-name -d ./typeORMCLI.config.ts`, to make the migration file, then `yarn migration:run` will automatically run on deployment to staging/production. Commit the migration file to Git!

### Adding an API Route

1. Add its request body and response types in `common`
2. Add routes to the NestJS server in `server` (using the `common` types) (to do this, read the NestJS docs, or refer to the wiki written in the future :P )
3. Add client functions in `frontend/app/api` calling the endpoint (using the `common` types)

### Testing

Unit test files should be colocated with the file they test. 

Integration tests are located in the `test` folder.

~~End to end (E2E) testing is in it's own folder and done with Cypress. These should be used to test core user flows. To run them headlessly (without a graphics server), do `yarn cypress run`. To watch them actually run interactively, you can use `yarn cypress open`. Be aware that this is _super slow_ on local machines.~~ (note: cypress has been removed, for now)

To run a specific unit test suite, you can run `yarn test:unit suite-name` e.g. `yarn test:unit course`

If your tests are failing with a message about "deadlock something whatever", do `yarn test --run-in-band`. This makes the tests run sequentially.

If `yarn test` is not running all of the tests, navigate to `server/test` folder and run `yarn jest --config ./test/jest-integration.json -i --run-in-band` if you would like to run all the integration tests. To run the tests of a specific integration test file (e.g. course.integration.ts), you can use `yarn jest --config ./test/jest-integration.json -i --run-in-band course`


> [!NOTE]
> cypress is currently broken (and its code was recently removed). Only the endpoints are being tested right now

#### All tests are failing locally

If all your tests are failing locally but passing on github actions, it likely means that there is still stuff in your `test` database that hasn't been deleted.

To fix this, run the following sql command on your `test` database to delete all tables:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

From there, your tests should start passing again.

If you're getting "deadlock detected", there is no known way of fixing that, other than there may just be tests that are missing awaits and are trying to do stuff at the same time.

### Installing new packages

Install packages from `cd` into the project you want to install the package for, then run `yarn add <PACKAGE>`. For instance, if you want to install a frontend
package, `cd packages/app` and then `yarn add <FRONTEND PACKAGE>`

## Code Formatting

[Prettier](https://prettier.io/), a highly opinionated code formatter, runs right before you commit to git. So don't worry about formatting your code! Prettier will clean it all up. You can also get the Prettier extension in most IDEs, or run `yarn pretty-quick` if you want to.

## Tips

- In VSCode, Ctrl+Clicking functions (or variables) is your best friend when navigating the code. Ctrl+Clicking a function that is being called will take you to where it is defined. Ctrl+Clicking a function definition will show you everywhere it is called (which can be helpful for figuring out if something will break).
- In VSCode, the "Search" tab (Ctrl+Shift+F) is your best friend when you need to find something across the entire codebase (helpful for finding related files)
- `Tailwind CSS IntelliSense` is a good VSCode extension that lets you autocomplete tailwind classes as well as give previews as to what each class does
- In VSCode settings, enable `Explorer > File Nesting: Enabled` and `Explorer > File Nesting: Expand`, and especially set `Explorer: Sort Order` to **filesFirst**. This will make the file tree much more navigable.
- Want to get to the course page, queue page, or another page quickly? In the top search bar in VSCode, try just searching "queue page" or "course page" and it will show related pages (should be easier than searching through the file folders manually)

## Testing the Production Environment

Want to try running the prod environment on your local machine? Follow these steps:
- run `yarn build` in the root directory (you may need to run the terminal as administrator)
- Once done, run `yarn prod:start` in the root directory
- run `yarn dev:proxy` in a separate terminal in the root directory

Once done, you should be able to visit the website at http://localhost:3001

## Production

If you have prod ssh access, deploy master to prod with `./deploy.sh <prod username>`.

On the VM, source code is at `/var/www/source`. From there you can run `yarn cli` commands etc. Make an admin account with `yarn cli create:admin <name>` and give a password. Please auto-generate a random password.

If you need to hotfix something, you can edit the files on prod and run `yarn build && env HOME=/var/www pm2 startOrReload infrastructure/prod/ecosystem.config.js` to build and restart the server. Try to avoid doing this.
You can also push something to master, and then use the deploy script. Note that it'll still take about 5 minutes for the changes to propagate to the dist folder

### Changelog
The changelog (```./packages/frontend/public/changelog.md``` from project-root) contains a formatted list of feature roll-outs for each deployment update.

Be sure to update this file, the version number in the footer, and set all users' ```readChangeLog``` attributes in the User model of the database to false before finishing deployment updates.

## Misc

Your IDE should do type-checking for you. You can run type-checks manually with `yarn tsc`.