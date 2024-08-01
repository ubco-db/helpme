# Preface

This guide is intended for new developers who are looking to contribute to the HelpMe system and seeks to explain how some of the technologies are used as well as the history of the system. 

`DEVELOPING.md` has more details on how to set up the system and start developing. 

# INTRO TO THE CODEBASE AND TECHSTACK

## Codebase

File structure is as follows:
- `/docs` - contains most of the documentation for the project
- `/infrastructure` - I have never had to look in here
- `/packages` - contains all the code for the project
  - `/server` - backend code
    - `.env` - 
    - `/src` - contains all endpoints and unit tests
    - `/migration` - contains auto-generated migrations, which are used to keep track of database changes (see more in `DEVELOPING.md`)
    - `/test` - contains integration tests
  - `/frontend` - frontend code
    - `/api`
        - `index.ts` - This is our first important index.ts. Contains functions that call the backend endpoints. It keeps the fetch calls all in one place, making it easier to maintain (e.g. if you renamed an endpoint)  
    - `/app` - contains all the pages and components
    - `/public` 
  - `/common` - shared code between the frontend and backend
    - `index.ts` - This is our other important index.ts. Contains all types or functions used on both the frontend and backend

## Technologies Guide

`.env` - Rather than storing sensitive information (such as API keys, database passwords, etc.) in the codebase, we store them in a `.env` file. This file is not tracked by git, so it is not shared with anyone else. You will need to create multiple `.env` files for the project, one for the frontend and one for the backend. Follow the example `.env` files in the respective directories to see what you need to add. More details about what each variable does or how to get them can be found in `ENVIRONMENT_VARIABLES.md`. environment

### Frontend

`hooks` - Unlike regular functions, hooks can have side effects and can be used to manage state. They are used in React to manage state and side effects in functional components. We use hooks to manage the state of the application, such as the queue, courses, and questions.

`swr` - Normally, if you want all clients to have up-to-date data, you need to either have the server initiate requests/messages (e.g. using websockets) or by having clients poll the server every so often to see if there is new data. SWR is a javascript library that basically adds a fancy polling system to your endpoints to keep your data up-to-date. You can wrap your endpoint calls with useSWR and it will make sure your data is up to date (though it won't update quite as fast as websockets). We make great use of this library in our codebase. For example, we use it to make sure course data is up-to-date (useCourse), for getting up-to-date questionTypes (useQuestionTypes),

`useQueue` & `useQuestions` & `SSE` - These components consist of a bunch of infrastructure to make the queue as close to real-time as possible. useQueue is for all queue details except for questions, and useQuestions is for questions (it also contains any questionsGettingHelp, priority queue, your own questions, and more). It seems to use a mix of websockets (maybe) as well as a lot of other custom infrastructure which probably doesn't even increase the performance that much. All this infrastructure could probably be replaced with useSWRSubscription or something else, though the current system works well enough and it would take a lot of work change. SSE stands for Server Side Events, and allows clients to subscribe to particular events that happen on the server (e.g. when a new question is created, the server sends the event to all subscribed clients (i.e. all browsers viewing the queue page) to tell them to pull the new questions from the database).

#### Next.js

Note if you are looking at the Next.js docs: Make sure you set it to "Using App Router" and NOT "Using Pages Router"

`layout.tsx` - This is a special file that is used to wrap all pages in a layout. This is useful for adding a navbar, footer, or other components that should be on every page. It is also useful for adding global styles or scripts.

`page.tsx` & file structure - Each folder represents a navigation route (for example, `app/courses/page.tsx` will automatically become `localhost:3000/courses` in the browser). Groups (e.g. `(dashboard)` or `(auth)`) work more like traditional folders. Dynamic routes (i.e. `/course/[cid]` and `/course/[cid]/queue/[qid]`) will have their 'dynamic' part replaced with a number (e.g. `[cid]` becomes `1`) and can be accessed by using `params` in their page.tsx.

All pages are functions (e.g. `export default function CoursePage(...)`) and all components are react functional components (e.g. `const CircleButton: React.FC<CircleButtonProps> = ({...`)

`'use client'` & `'use server'` - These are from Next.js, and allow us to define whether a component is rendered on the client or the server. In general, you want to use 'use server' where possible, as it allows the server to make calls to the database and render the page right away, improving load times and performance. The only issue is that 'use server' cannot be used with components that the user interacts with as well as other restrictions. Our application is pretty client-heavy (with lots of interactions from the user) and was also built before server components were possible, so most of the components are client components. Server components can have client components in them, but not vice-versa (with the exception of layout.tsx, which can still be client.tsx). More info here https://nextjs.org/learn/react-foundations/server-and-client-components

### Backend

`module` - I believe this is only for nestjs for connecting the service to the controller, but maybe you can do some other cool stuff here.

`controller` - Defines an endpoint and the various calls you can make to it. Takes in requests, does business logic, and then sends a response (please use `@Res` for sending a response, as it is more flexible). They're supposed to be fairly lightweight and not call the database directly; however, nearly all of our endpoints are implemented incorrectly where the entire endpoint is written in the controller. Integration tests test these.

`service` - These define methods that make calls to the database. Unit tests test these.

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

# TODO

## For the whole project

- Do a ctrl+shift+f for "TODO" and do all TODOs

## For this document
- Add a list of TODOs
- Add more technologies
- Merge stuff from DEVELOPING.md
- move DEVELOPING.md, ENVIRONMENT_VARIABLES.md , and other .mds into docs, then make markdown links to the other documents.