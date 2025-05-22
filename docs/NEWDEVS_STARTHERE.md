# Glossary

- [Glossary](#glossary)
- [Preface](#preface)
- [INTRO TO THE CODEBASE AND TECHSTACK](#intro-to-the-codebase-and-techstack)
  - [Codebase](#codebase)
  - [Technologies Guide](#technologies-guide)
    - [Environment Variables](#environment-variables)
    - [Frontend](#frontend)
      - [Next.js](#nextjs)
        - [What's with all these `'use client'` \& `'use server'` things?](#whats-with-all-these-use-client--use-server-things)
      - [Tailwind and CSS](#tailwind-and-css)
      - [JSX](#jsx)
    - [Backend](#backend)
      - [Nest.js files](#nestjs-files)
      - [Redis](#redis)
      - [Endpoints](#endpoints)
        - [Guards and `@Roles`](#guards-and-roles)
        - [`@User` and `@UserId` decorators](#user-and-userid-decorators)
        - [Gotchas while naming your endpoint - Routing mismatches](#gotchas-while-naming-your-endpoint---routing-mismatches)
        - [Endpoints that change their behavior based on role](#endpoints-that-change-their-behavior-based-on-role)
        - [Why some endpoints have `@Res` and some don't](#why-some-endpoints-have-res-and-some-dont)
          - [Ways to return errors/http status codes + messages](#ways-to-return-errorshttp-status-codes--messages)
      - [TypeORM](#typeorm)
        - [Examples of typeorm runtime errors](#examples-of-typeorm-runtime-errors)
          - [Missing relations](#missing-relations)
          - [Querying with models and IsNull()](#querying-with-models-and-isnull)
          - [.find() returns null not undefined if not found](#find-returns-null-not-undefined-if-not-found)
        - [.save()](#save)
        - [Transactions](#transactions)
          - [Important edge case with transactions](#important-edge-case-with-transactions)
      - [Testing](#testing)
        - [What is mocking?](#what-is-mocking)
        - [To mock or not to mock?](#to-mock-or-not-to-mock)
- [History](#history)
- [TODO](#todo)
  - [For the whole project](#for-the-whole-project)
  - [For this document](#for-this-document)

# Preface

This guide is intended for new developers who are looking to contribute to the HelpMe system and seeks to explain how some of the technologies are used as well as the history of the system. 

**Important:** When you're reading this, don't worry if you don't understand everything yet. Just give it a light read to gain a surface level understanding about what's talked about. Then when you encounter relevant code, you can refer back to this to get the full context.

`DEVELOPING.md` has more details on how to set up the system and start developing. 

# INTRO TO THE CODEBASE AND TECHSTACK

## Codebase

File structure is as follows:
- `/docs` - contains most of the documentation for the project
- `/infrastructure` - I have never had to look in here
- `/packages` - contains all the code for the project
  - `/server` - backend code
    - `.env` - Environment variables for server
    - `postgres.env` - Environment variables specific to the database
    - `/src` - contains all endpoints and unit tests
    - `/migration` - contains auto-generated migrations, which are used to keep track of database changes (see more in `DEVELOPING.md`)
    - `/test` - contains integration tests
  - `/frontend` - frontend code
    - `.env` - Environment variables for the frontend
    - `/api`
        - `index.ts` - This is our first important index.ts. Contains functions that call the backend endpoints. It keeps the fetch calls all in one place, making it easier to maintain (e.g. if you renamed an endpoint, you only need to change in 1 area)  
    - `/app` - contains all the pages and components
    - `/public` - Contains 
  - `/common` - shared code between the frontend and backend
    - `index.ts` - This is our other important index.ts. Contains all types or functions used on both the frontend and backend

## Technologies Guide

### Environment Variables

`.env` - Rather than storing sensitive information (such as API keys, database passwords, etc.) in the codebase, we store them in a `.env` file. This file is not tracked by git, so it is not shared with anyone else. You will need to create multiple `.env` files for the project, one for the frontend and one for the backend. Follow the example `.env` files in the respective directories to see what you need to add. More details about what each variable does or how to get them can be found in [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). 

You will also need to create a `postgres.env` in your `/server` directory. The reason it is separate from the `/server` .env is that the entire `postgres.env` is loaded into the postgres container.

For the frontend `.env`, use `dev.env` as a template (create a copy of `dev.env` and rename it to `.env`).

For the server `.env`, use `.env.development` as a template (create a copy of `.env.development` and rename it to `.env`).

Note that if you are also setting up the chatbot repo, it also needs a `.env`, which uses `env.example` as a template. Inside this `.env` is where you would put your Open AI API key so you can properly interact with the chatbot while developing (contact one of the HelpMe devs if you don't have an Open AI key with funds on it and we will provide you with one).

### Frontend

`hooks` - Unlike regular functions, hooks cannot be conditionally called. React has a lot of different hooks, but the most common ones are: 
- `useState` is used to store state in a component (like if a modal is open)
- `useEffect` is used to run code when the component is rendered. The second argument is an array of dependencies, which will cause the code to re-run if any of the dependencies change. If you want the code to only run once, pass an empty array.
- `useCallback` is used to memoize functions (i.e. store a function so it doesn't get recreated every time the component is rendered)
- `useContext` is basically like a global state variable. Useful for not needing to pass props down through many layers of components. We use this for the userInfo context, which stores the user's information (e.g. their name, email, etc.)
- We also have a lot of custom hooks that we have made, such as `useCourse`, `useQueue`, `useQuestions`, and `useQuestionTypes`. These are wrappers around useSWR for getting up-to-date data from the backend.

`swr` - Normally, if you want all clients to have up-to-date data, you need to either have the server initiate requests/messages (e.g. using websockets) or by having clients poll the server every so often to see if there is new data. SWR is a javascript library that basically adds a fancy polling system to your endpoints to keep your data up-to-date. You can wrap your endpoint calls with useSWR and it will make sure your data is up to date (though it won't update quite as fast as websockets). We make great use of this library in our codebase. For example, we use it to make sure course data is up-to-date (useCourse), for getting up-to-date questionTypes (useQuestionTypes),

`useQueue` & `useQuestions` & `SSE` - These components consist of a bunch of infrastructure to make the queue as close to real-time as possible. useQueue is for all queue details except for questions, and useQuestions is for questions (it also contains any questionsGettingHelp, priority queue, your own questions, and more). It seems to use a mix of websockets along with a lot of custom logic. All this infrastructure could probably be replaced with useSWRSubscription or something else, though the current system works well enough and it would take a lot of work change. SSE stands for Server Side Events, and allows clients to subscribe to particular events that happen on the server (e.g. when a new question is created, the server sends the event to all subscribed clients (i.e. all browsers viewing the queue page) to tell them to pull the new questions from the database).

#### Next.js

Note if you are looking at the Next.js docs: Make sure you set it to "Using App Router" and NOT "Using Pages Router"

`layout.tsx` - This is a special file that is used to wrap all pages in a layout. This is useful for adding a navbar, footer, or other components that should be on every page. It is also useful for adding global styles or scripts.

`page.tsx` & file structure - Each folder represents a navigation route (for example, `app/courses/page.tsx` will automatically become `localhost:3000/courses` in the browser). Groups (e.g. `(dashboard)` or `(auth)`) work more like traditional folders. Dynamic routes (i.e. `/course/[cid]` and `/course/[cid]/queue/[qid]`) will have their 'dynamic' part replaced with a number (e.g. `[cid]` becomes `1`) and can be accessed by using `params` in their page.tsx.

All pages are functions (e.g. `export default function CoursePage(...)`) and all components are react functional components (e.g. `const CircleButton: React.FC<CircleButtonProps> = ({...`)

**Hydration Error** - This error occurs when the server and client render different things. This can happen when the server renders a component that the client doesn't, or when the server renders a component with different props than the client. Usually, these happen from some illegal HTML (e.g. a div inside a p tag) or some other nonos. The most common one I've encountered is ones with antd's `<Spin/>`, and can be fixed by making sure it's within the `<main>` content of the page. More here https://nextjs.org/docs/messages/react-hydration-error

##### What's with all these `'use client'` & `'use server'` things? 

These are from Next.js, and allow us to define whether a component is rendered on the client, the server, or as a server action.

`'use client'` - This component will be sent to the browser to be rendered. Any component that stores state (i.e. with `useState`), has interactability (buttons, forms, etc.), or uses *any* hooks (such as `useCourse` or `useEffect`)

**Components with no 'use client' or 'use server'** - These are **server components** (er well they will need the `async` keyword beside function too maybe). These are rendered on the server and sent to the browser and in general you want as many things as possible to be server components. They have the advantage that any fetch calls within them will be made right-away on the server, before anything is rendered, which can improve performance a lot. They can also have client components within them, but not vice-versa (with the exception of layout.tsx), so try to have server components near the root and client components as far down as possible. 

`'use server'` - In general, don't use this as that's for *making server actions* and *NOT for designating server components*. Server actions are "asynchronous functions" and are sorta like endpoints. We don't really use these as we are using our own endpoints. 

Our application is pretty client-heavy (with lots of interactions from the user) and was also built before server components were possible, so most of the components are client components. 

More info here https://nextjs.org/learn/react-foundations/server-and-client-components and here https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations


#### Tailwind and CSS

`Tailwind` basically creates a className for every single css property (and culls unused ones). Helps keep styling close to where the code was written (LoC) and prevents worrying about changing a css file and breaking something else. While it covers about 99.9% of cases, there are still some scenarios where you will need to create custom css (such as animations). You can either add said custom css inside `globals.css` or you can modify the `tailwind.config.js` file to add custom css classes.

Some things to note about tailwind:
- each number corresponds to 0.25rem (or 4px). So doing `mt-5` is the equivalent of doing `margin-top: 1.25 rem` (or 20px)
- All colors/numbers/etc can be replaced with a custom value with square brackets (e.g. `py-[0.125rem]` will give vertical padding of 0.125rem)
- media-queries are *min-width* and not *max-width*. So, doing `md:flex` will give flex for medium (~768px) screens and up. So, if you want something to have less width on mobile, you do `classname="w-10 md:w-20"`
- Chatgpt will often times mess up all of these things above
- We use the `md:` breakpoint to designate mobile and desktop breakpoints. If you use `sm:`, you will get a weird scenario where some UI components are displaying their mobile version while other's their desktop version

#### JSX

`JSX` is a syntax extension for JavaScript that looks similar to XML or HTML. It is used with React to describe what the UI should look like.

Want to conditionally render something like an `if` statement? Do: `{condition && (<Component />)}`
Want to conditionally render something like an `elseif` statement? Do: `{condition ? (<Component />) : (<OtherComponent />)}`

### Backend

#### Nest.js files

`module` - Used by nest.js to figure out what services each controller/service needs. You usually don't need to touch these unless you are making a new controller or service file.
- **Advanced**: Inside the module, you can specify multiple things:
  - **controllers**: all controllers for this module. Each module should have maybe 1-2 controllers (e.g. queue.module.ts has QueueController and QueueInviteController)
  - **providers**: these are all the services that all your services, controllers, or *services' dependencies* depend on.
    - E.g. In queue.module, if QueueService needs QuestionService, and QuestionService needs AlertsService, then you must put QueueService,QuestionService, *and* AlertsService as providers
      - However, you can also make question.module, which is an **import** in queue.module, **export** AlertsService and it should automatically be made a provider
  - **imports**: these are *modules* that you must import if you want access to the services said module exports (e.g. you want to use some function from question.service, so you must add QuestionModule as an import)
  - **forwardRef** - Used to resolve a circular dependency where two modules depend on each other

`controller` - Defines an endpoint and the various calls you can make to it. Takes in requests, does business logic, and then sends a response. They're supposed to be fairly lightweight and not call the database directly; however, nearly all of our endpoints are implemented incorrectly where the entire endpoint is written in the controller. Integration tests test these.

`service` - These define methods that make calls to the database. Unit tests test these.

`entity` - These define the database schema. If you make any changes to these, be sure to make a migration (see `DEVELOPING.md`). If you are making a new entity, be sure to add it inside `ormconfig.ts`!

#### Redis

`redis` - A fast, in-memory database that we use for caching frequently accessed data. Sometimes, there can be issues where the redis database is not in sync with the actual database. If this happens, follow these steps to flush the redis cache:
1. Open the redis container in docker desktop and go to the "Exec" tab
2. Run `redis-cli` to open the redis command line
3. Run `flushall` to flush the cache

#### Endpoints

##### Guards and `@Roles`

Guards are a thing from Nest.js. They are basically pretty functions that you can "decorate" at the top of your function rather than in the function body. 

Some that you will see are jwtAuthGuard (checks if user is logged in) as well as emailVerifiedGuard (only users with verified email can access this endpoint). 

One special one to note is CourseRolesGuard (only users in the course with the specified role may call this endpoint), which requires one of the params to have a name of courseId, id, or cid. Without one of these params, it will think none is provided and will error (so the endpoint must take one of these in order to function). 
This guard (as well as others) will interact with the `@Roles` decorator, which specifies which roles CourseRolesGuard will take.
- Note that without a decorator to consume the roles (CourseRolesGuard, AsyncQuestionRolesGuard, OrganizationRolesGuard, etc.), `@Roles` *will not do anything* (think of `@Roles` like an argument to a function)

##### `@User` and `@UserId` decorators

Want the user details of the user that called the endpoint? Add a `@User` as one of the parameters to the controller function.

If you only need the userId of the user that called the endpoint, use the `@UserId` parameter instead as it won't perform a database query.

##### Gotchas while naming your endpoint - Routing mismatches

`questions/:userId` and `question/:courseId` may look like different endpoints, but when called with `GET question/1` the Express routing system won't know which one to call, and might just pick the endpoint that appears first in the file (with no error otherwise).

To fix this, you could name your endpoints something like `questions/user/:userId` and `question/course/:courseId` so that it's obvious which endpoint gets called with `GET question/user/1`.

Though, I have also experienced a time where a route subpath was inserted as an id, for example if I have two endpoints:
- `queue/:id`
- `queue/allqueues`

and then try to call `GET queue/allqueues`, sometimes the routing will decide that you wanted to call `queue/:id` with "allqueues" as the :id parameter. I forget the fix for this, other than maybe try moving the endpoint to a different spot in the file (there's probably a better solution here lol please feel free to edit this).

##### Endpoints that change their behavior based on role

Lets say you have an endpoint that returns different data or does different actions based on the *role* of who is calling it.

For example, you're making an endpoint gets all queue questions for a user as a nice history. 

`@Get('questions/history/:userId')`

It may be tempting to make it so this endpoint will only allow non-admins to get the question history for themselves and allow admins to get any any data they want, though I want to warn you that this can quickly cause your endpoints to become bloated and hard to follow (there were and still are plently of endpoints in this backend that behave differently based on the user's role, and they are some of the largest endpoints/service functions and are almost always hard to follow).

Instead, I would suggest having two endpoints, one for admins and one for everyone else:

```ts
@Get('questions/history')
async getMyQuestionHistory(
  @UserId() userId: number, // the userId of the currently logged-in user that's calling this endpoint
)
// ...

@Get('questions/history/:oid/:userId') // :oid (org id) is needed here for the OrganizationRolesGuard to work (since it needs to check if the user is an admin in this organization)
@UseGuards(OrganizationRolesGuard) // this guard with this role will make it so only admins can call this endpoint
@Roles(OrganizationRole.ADMIN)
async getUsersQuestionHistory(
  @Param('userId', ParseIntPipe) userId: number, // the userId that the user provides themselves when they call this endpoint
)
// ...
```

Though then again, if the endpoint is like 90% of the exact same logic/code, then it's going to be a lot of duplicate code which isn't good. So in general split the endpoints based on role rather than having one mega-endpoint unless the difference in code is very small.

##### Why some endpoints have `@Res` and some don't

So the first thing to understand is Nest.js is built off of express.js (or at least our version is).

`@Res` is a thing from express that allows you to send responses from your endpoints.
e.g. `res.status(200).send(updatedQuestion)`

You would also send all your errors this way, e.g. `res.status(404).send("Question Not Found")`

However, Nest.js adds some other ways of doing things so you don't need to use `@Res`:
- You can throw different types of HttpExceptions (see next section)
- To return a response, just use `return`
  - e.g. `return updatedQuestion`
    - This will automatically be a 200 status response

###### Ways to return errors/http status codes + messages

There are multiple ways to make your endpoints give different errors/status codes. There's no real difference. Nest.js will catch any uncaught errors and return the corresponding error code and given message.
- `throw new xyzException("Some message")` - recommended (simple)
  - e.g. `throw new BadRequestException("SomeField must not be empty")`
  - Note that these exceptions must be instance of an HttpException (regular exceptions like FileNotFound will become 500 errors)
- `throw new HttpException("Some message", HttpStatus.NOT_FOUND)`
- `res.status(status code).send(an object or message text)`
  - e.g. `res.status(201).send(newlyCreatedComment)`
  - note you will need to add the `@Res()` decorator at the top of the controller
  - This also lets you return other status codes (e.g. 201 Created) and is not just limited to errors

#### TypeORM

ORM stands for Object-Relational Mapping. It's used to transform database rows into javascript objects. There are many ORMs out there, but long ago the original devs chose TypeORM as their ORM of choice (probably because it's one of the first listed ORMs in the Nest.js docs).

Note that we are currently on an outdated version of it (0.2.x) and the newest version is 0.3.x, meaning that a lot of the docs or code you may see elsewhere (e.g. generated by copilot) may not work with our version. Though, we are working to update it real soon (check the package.json in /server to see if its updated. If it is please remove this section).

This section may be expanded upon in the future, but for now it might be best to just look at how other services/controllers do queries and kinda copy that.

##### Examples of typeorm runtime errors

###### Missing relations

One thing to note is that sometimes the types for the queries may be wrong.
For example, you might want to check if the user is a TA or Prof in any course, so you do:
```ts
const user: UserModel = await UserModel.findOne({
  where: {
    id: userId
  }
});
const isStaff = user.courses.some((userCourse) => userCourse.role === Role.PROFESSOR || userCourse.role === Role.TA);
```
This will result in a *runtime* error (so you get no warning beforehand) because `user.courses` will be undefined because the database join was not made.

You can perform the database join like so (see https://orkhan.gitbook.io/typeorm/docs/find-options for more details/options):
```ts
const user: UserModel = await UserModel.findOne({
      where: {
        id: userId,
      },
      relations: { // this performs a join to get the user's UserCourses
        courses: true
      }
    });
```

###### Querying with models and IsNull()

```ts
const alerts = await AlertModel.find({	    
  where: {	   
    courseId,	
    user,	
    resolved: null,	      
  },
});
```

This would cause a runtime error for two reasons:
1. You cannot query with `null` and must instead use `IsNull()`
2. For some reason you can no longer query with a Model (in this case it was a UserModel). You must query with an id.

Example fix:
```ts
const alerts = await AlertModel.find({	    
  where: {	   
    courseId,	
    userId: user.id,	
    resolved: IsNull(),	      
  },
});
```

###### .find() returns null not undefined if not found

This was a change relevant to typeorm going from v0.2.x to v0.3.x.

This only really matters if you are checking if a particular entity exists in the database.

##### .save()

Doing `someEntityObject.save()` is kinda a magic method that will do both inserts and updates. It will also return the updated entity all serialized into the object you want.

Doing `.update()` or `.insert()` will not serialize the data and will only return the raw data, but is generally faster. So use `.update()` and `.insert()` if you know you don't need the saved entity returned.

##### Transactions

If your endpoint involves multiple database calls, it is recommended to use a transactionalEntityManager so that all the queries will run in a transaction. 

This is important because if any queries fail, you usually want all queries in the transaction to be automatically rolled back. 

Here is an example from the addEvent() method inside calendar.controller.ts:

```ts
await this.dataSource.transaction(async (transactionalEntityManager) => {
  event = await transactionalEntityManager.save(CalendarModel, { // Important that you do this instead of CalendarModel.save() otherwise it will not be inside the transaction.
    title: body.title,
    start: body.start,
    // other attributes...
  });
  if (body.staffIds) {
    for (const staffId of body.staffIds) {
      await this.calendarService.createCalendarStaff(
        staffId,
        event,
        transactionalEntityManager, // notice how you can pass the transactionalEntityManager to service methods, which can then use it to make queries that would outside of the transaction otherwise
      );
      await this.calendarService.createAutoCheckoutCronJob(
        staffId, // even if this method throws an error, the transaction will fail and all the above queries will get rolled back
        event.id,
        event.startDate,
        event.endDate,
        event.end,
        event.daysOfWeek || [],
        cid,
      );
    }
  }
});
```

There are more examples inside asyncQuestion.controller.ts

###### Important edge case with transactions

When you do:
```ts
createdQueue = await transactionalEntityManager
    .create(QueueModel, {
      room,
      courseId,
      type,
      staffList: [],
      questions: [],
      allowQuestions: true,
      notes,
      isProfessorQueue,
      config,
    })
    .save();
```
typeorm will decide to put that into a transaction *inside* your other transaction (because frick you). Replace that code with the following:
```ts
createdQueue = await transactionalEntityManager
      .getRepository(QueueModel)
      .save({
        room,
        courseId,
        type,
        staffList: [],
        questions: [],
        allowQuestions: true,
        notes,
        isProfessorQueue,
        config,
      });
```

#### Testing

##### What is mocking?

Mocking is when you replace one function with another "mock" function instead. This mock function is usually just an empty function, but you can have it return something too (e.g. dummy data).

##### To mock or not to mock?

In general, it is recommended to only mock if you absolutely have to. For example, maybe you are testing a function that sends an email using EmailService, but you don't actually want to send emails out, so instead you can mock the sendEmail function and purely just check to make sure that sendEmail is being called with the right arguments.

Another example where you might need to mock is if you are dealing with a technology/library that doesn't play nice with jest for whatever reason (e.g. maybe redis or cron).

In general though, try not to mock (e.g. don't mock database calls/returns). This is because mocking eliminates one of the key benefits of testing: knowing what things break after a change (aka regression testing). If you mock someone else's function but then they change something about it (like its parameters), the tests may still pass even though they should have failed. Another example is when you update a package and they adjust their APIs or behaviour but since you mocked their functions the test still pass instead of failing.

# History

The system was first forked off of [Khoury College's Office Hours system](https://github.com/sandboxnu/office-hours) to be adapted and used for UBCO. The first major test of the system was in COSC 404 in 2022W and was used for hybrid office hours and lab sessions. The results were a resounding success, as the queueing system allowed for labs and office hours to much more easily be managed, cutting confusion for both staff and students. The system also allowed professors to gather insights about what type of questions are being asked and when, which they can then integrate into the design of their courses. 

Since that first test, there has been significant improvements to the system. 
- A course chatbot was added, allowing professors to upload course materials and have the chatbot answer in accordance with these sources. This also comes with tools to customize the AI and the responses it gives, as well as a way to return responses for previously asked questions. As this is a hot area right now, the repo for the chatbot is private, and you will need to contact the maintainers to get access.
- An asynchronous question centre (aka Anytime Questions) was added, which effectively serves as an email 2.0. Any questions asked here will automatically be answered by the course AI, which TAs and professors can then adjust the answer of. Profs and TAs also have the option of posting the question for other students to see, which can be useful for common questions. 
- Many UI improvements and other smaller features

In March 2024, it was decided to copy over the code to a new repo with a fresh commit history. This was because of the number of changes to the system, the desire to change the repo url (as the system is more than just office hours now), and to clean the messy commit history.
Old repo: https://github.com/ubco-db/office-hours
New Repo: https://github.com/ubco-db/helpme

During the 2024 Summer, a massive undertaking was done to refactor and re-write nearly the entire frontend. The benefits to this was as follows:
- Upgrade Next.js from v11 to v14, which brought a ton of improvements and optimizations
    - As a small note, the old frontend used to be located in `/app` and it is now located in `/frontend`  
- Upgrade of many other packages to new versions
    - `antd` - Upgrade from v4 to v5 which brought a ton of usability, accessibility, and performance improvements, as well as new components to use
    - Can now use components from `shadcn`
    - Some of these packages had known security vulnerabilities in them, which were fixed by upgrading
- The old codebase would give typescript errors on most functional components, which was really annoying
- Cut out a lot of old, unused code
- Rewrite a lot of the code to have better performance, usability, accessibility, and maintainability
- Rename files and components to make more sense

[2024-07-29] Renamed Asynchronous Question Centre to Anytime Questions Hub. Most code will still refer to it as the Async Centre/Async Questions.

[2025-04] Finally updated the typeorm version from 0.2.x to 0.3.x. You can now rely on typeorm documentation and it will be accurate (doing this also fixes a 9.7 critical vulnerability and allows us to start running migrations on prod)

[2025-05] (not here yet) Upgraded from Next.js v14 to v15. The most notable advantage of this is it now uses the React 19 compiler, making useCallback and useMemo not really necessary, plus other free performance gains. Also started using turbopack for dev for faster compile times (making it easier to manually test). Though production build still uses webpack since sentry does not support it yet.

# TODO

## For the whole project

- Maybe check out the "issues" page on github
- Do a ctrl+shift+f for "TODO" and do all TODOs

## For this document
- Add a list of TODOs 
- Add more technologies
- Merge stuff from DEVELOPING.md