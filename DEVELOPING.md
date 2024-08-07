# Developing Guidelines

- [Installation](#installation)
- [Technologies](#technologies)
- [File Structure](#file-structure)
- [Developing](#developing)
  - [Running locally outside of Docker container](#running-locally-outside-of-docker-container)
  - [Running locally within a Docker container](#running-locally-within-a-docker-container)
  - [Database Changes](#database-changes)
    - [Migrations](#migrations)
  - [Adding an API Route](#adding-an-api-route)
  - [Adding to the frontend app](#adding-to-the-frontend-app)
  - [Testing](#testing)
  - [Installing new packages](#installing-new-packages)
- [Style](#style)
- [Tips](#tips)
- [Production](#production)

## Installation to run locally

1. [Get Docker](https://docs.docker.com/get-docker/) so we can automatically run and setup Postgres
2. Make sure you have [node](https://nodejs.org/en/download/), [yarn](https://classic.yarnpkg.com/en/docs/install), and [psql](https://blog.timescale.com/tutorials/how-to-install-psql-on-mac-ubuntu-debian-windows/) installed. `yarn -v` should be `1.x.x`. Do not get Yarn 2. Node should also be version 14.x.x. If it's not, install [nvm](https://github.com/nvm-sh/nvm)
3. Run `yarn install` in this directory to get dependencies
4. Run `yarn dev:db:up` to start the database via docker; `yarn dev:db:down` will stop it.
5. Change the environment variables to match your environment. You can find the required environment variables in the `.env.development` file in the `packages/server` directory. If you are running the app in a Docker container, you should change the environment variables in the `.env.docker` file in the `packages/server` directory.
5. Start the app in development with `yarn dev`
6. Visit the app at http://localhost:3000/dev and seed the database
7. Visit the app at http://localhost:3000

If you have any questions, feel free to reach out to a member of the team. If you think this document can be improved, make a PR!

## Technologies

-   [Next.js](https://nextjs.org/docs/getting-started) lets us do server-side and client-side React rendering, as well as write backend API endpoints (we don't use this for KOH).
    It also gives us developer ergonomics like hot reload in dev.

-   [nestjs](https://nestjs.com/) runs our backend http api. It gives us controllers and services and helps neaten the code

-   [Typescript](https://www.typescriptlang.org/docs/home.html) lets us write maintainable, scalable Javascript

-   [Postgresql](https://www.postgresql.org/docs/11/index.html) is a very reliable and popular SQL database that is great for 99% of applications

-   [TypeORM](https://typeorm.io/) lets us query Postgres easily and with Typescript validating our schema.

-   [Docker](https://www.docker.com/products/docker-desktop) sets up a consistent Postgres + Redis environment on all developer's machines

-   [Redis](https://redis.io/) is used to enable 0 downtime deploy

-   [Cypress](https://www.cypress.io/) is used for frontend E2E tests. Currently not being used.

## File Structure

Source code is in the `packages` folder.

`app` is a the next.js app (frontend). Routing is done using the file system. For example, the page `/app/pages/xyz.tsx` would be served at `domain.com/xyz`. Pages are rendered server-side and hydrated client side. Data fetching can happen on the server or client. [Learn more](https://nextjs.org/docs/basic-features/data-fetching)

`server` is the server (backend) that runs the REST API and websockets. Each API route is controlled by a module, with a controller and its modules. [Learn more](https://nestjs.com/)

`api-client` is a library to wrap network calls to the api in a neater, **type-safe** interface. Every backend route should be accessible through `api-client`

`common` is where common code, globals, and types go. It is imported into the other three packages.

The `infrastructure` folder is for docker and other deployment files. You can mostly ignore it.

## Developing

### Running locally outside of Docker container

Run `yarn dev` at root level to get everything running and hot-reloading. `yarn test` at root level runs all tests, but you can also selectively run tests by running `yarn test` while inside a package. Be sure to have the db running with `yarn dev:db:up` before running dev or tests.

Your IDE should do type-checking for you. You can run type-checks manually with `yarn tsc`.

### Running locally within a Docker container

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
If you're creating a new `table_name.controler.ts` file, you must also add it to the `ormconfig.ts` file 

Also, you must update the `seed.controller.ts` file to reflect the new database changes. This seed file is used to populate the database with dummy data on http://localhost:3000/dev.

#### Migrations

If you change an entity, you MUST run `yarn migration:generate -n [migration-name]`, to make the migration file, then `yarn typeorm migration:run` will automatically run on deployment to staging/production. Commit the migration file to Git!

### Adding an API Route

1. Add its request body and response types in `common`
2. Add routes to the NestJS server in `server` (using the `common` types) (to do this, read the NestJS docs, or refer to the wiki written in the future :P )
3. Add client functions in `api-client` calling the endpoint (using the `common` types)

### Adding to the frontend app

Every component in `pages` is served publicly. See https://nextjs.org/docs/routing/introduction. Break pages down into components and add to `components` folder.
Each page should have the `Navbar` up top -- refer to other pages for each page. Consistency, consistency, consistency.

### Testing

Unit test files should be colocated with the file they test. 

Integration tests are located in the `test` folder.

End to end (E2E) testing is in it's own folder and done with Cypress (note: cypress has been removed, for now). These should be used to test core user flows.
To run them headlessly (without a graphics server), do `yarn cypress run`.
To watch them actually run interactively, you can use `yarn cypress open`. Be aware that this is _super slow_ on local machines.

If your tests are failing with a message about "deadlock something whatever", do `yarn test --run-in-band`. This makes the tests run sequentially.

If `yarn test` is not running all of the tests, navigate to `server/test` folder and run `yarn jest --config ./test/jest-integration.json -i --run-in-band` if you would like to run all the integration tests. To run the tests of a specific integration test file (e.g. course.integration.ts), you can use `yarn jest --config ./test/jest-integration.json -i --run-in-band course`

> [!NOTE]
> cypress is currently broken (and its code was recently removed). Only the endpoints are being tested right now

### Installing new packages

Install packages from `cd` into the project you want to install the package for, then run `yarn add <PACKAGE>`. For instance, if you want to install a frontend
package, `cd packages/app` and then `yarn add <FRONTEND PACKAGE>`

## Style

[Prettier](https://prettier.io/), a highly opinionated code formatter, runs right before you commit to git. So don't worry about formatting your code! Prettier will clean it all up. You can also get the Prettier extension in most IDEs, or run `yarn pretty-quick` if you want to.

## Tips

- In VSCode, Ctrl+Clicking functions (or variables) is your best friend when navigating the code. Ctrl+Clicking a function that is being called will take you to where it is defined. Ctrl+Clicking a function definition will show you everywhere it is called (which can be helpful for figuring out if something will break).
- In VSCode, the "Search" tab (Ctrl+Shift+F) is your best friend when you need to find something across the entire codebase (helpful for finding related files)

## Production

If you have prod ssh access, deploy master to prod with `./deploy.sh <prod username>`.

On the VM, source code is at `/var/www/source`. From there you can run `yarn cli` commands etc. Make an admin account with `yarn cli create:admin <name>` and give a password. Please auto-generate a random password.

If you need to hotfix something, you can edit the files on prod and run `yarn build && env HOME=/var/www pm2 startOrReload infrastructure/prod/ecosystem.config.js` to build and restart the server. Try to avoid doing this.
You can also push something to master, and then use the deploy script. Note that it'll still take about 5 minutes for the changes to propogate to the dist folder
