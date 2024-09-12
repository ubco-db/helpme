# Glossary

- [Glossary](#glossary)
- [Preface](#preface)
- [INTRO TO THE CODEBASE AND TECHSTACK](#intro-to-the-codebase-and-techstack)
  - [Codebase](#codebase)
  - [Technologies Guide](#technologies-guide)
    - [Frontend](#frontend)
      - [Next.js](#nextjs)
        - [What's with all these `'use client'` \& `'use server'` things?](#whats-with-all-these-use-client--use-server-things)
      - [Tailwind and CSS](#tailwind-and-css)
      - [JSX](#jsx)
    - [Backend](#backend)
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
    - `.env` - 
    - `/src` - contains all endpoints and unit tests
    - `/migration` - contains auto-generated migrations, which are used to keep track of database changes (see more in `DEVELOPING.md`)
    - `/test` - contains integration tests
  - `/frontend` - frontend code
    - `/api`
        - `index.ts` - This is our first important index.ts. Contains functions that call the backend endpoints. It keeps the fetch calls all in one place, making it easier to maintain (e.g. if you renamed an endpoint, you only need to change in 1 area)  
    - `/app` - contains all the pages and components
    - `/public` 
  - `/common` - shared code between the frontend and backend
    - `index.ts` - This is our other important index.ts. Contains all types or functions used on both the frontend and backend

## Technologies Guide

`.env` - Rather than storing sensitive information (such as API keys, database passwords, etc.) in the codebase, we store them in a `.env` file. This file is not tracked by git, so it is not shared with anyone else. You will need to create multiple `.env` files for the project, one for the frontend and one for the backend. Follow the example `.env` files in the respective directories to see what you need to add. More details about what each variable does or how to get them can be found in [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). environment

### Frontend

`hooks` - Unlike regular functions, hooks cannot be conditionally called. React has a lot of different hooks, but the most common ones are: 
- `useState` is used to store state in a component (like if a modal is open)
- `useEffect` is used to run code when the component is rendered. The second argument is an array of dependencies, which will cause the code to re-run if any of the dependencies change. If you want the code to only run once, pass an empty array.
- `useCallback` is used to memoize functions (i.e. store a function so it doesn't get recreated every time the component is rendered)
- `useContext` is basically like a global state variable. Useful for not needing to pass props down through many layers of components. We use this for the userInfo context, which stores the user's information (e.g. their name, email, etc.)
- We also have a lot of custom hooks that we have made, such as `useCourse`, `useQueue`, `useQuestions`, and `useQuestionTypes`. These are wrappers around useSWR for getting up-to-date data from the backend.

`swr` - Normally, if you want all clients to have up-to-date data, you need to either have the server initiate requests/messages (e.g. using websockets) or by having clients poll the server every so often to see if there is new data. SWR is a javascript library that basically adds a fancy polling system to your endpoints to keep your data up-to-date. You can wrap your endpoint calls with useSWR and it will make sure your data is up to date (though it won't update quite as fast as websockets). We make great use of this library in our codebase. For example, we use it to make sure course data is up-to-date (useCourse), for getting up-to-date questionTypes (useQuestionTypes),

`useQueue` & `useQuestions` & `SSE` - These components consist of a bunch of infrastructure to make the queue as close to real-time as possible. useQueue is for all queue details except for questions, and useQuestions is for questions (it also contains any questionsGettingHelp, priority queue, your own questions, and more). It seems to use a mix of websockets (maybe) as well as a lot of other custom infrastructure which probably doesn't even increase the performance that much. All this infrastructure could probably be replaced with useSWRSubscription or something else, though the current system works well enough and it would take a lot of work change. SSE stands for Server Side Events, and allows clients to subscribe to particular events that happen on the server (e.g. when a new question is created, the server sends the event to all subscribed clients (i.e. all browsers viewing the queue page) to tell them to pull the new questions from the database).

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

`module` - I believe this is only for nestjs for connecting the service to the controller, but maybe you can do some other cool stuff here.

`controller` - Defines an endpoint and the various calls you can make to it. Takes in requests, does business logic, and then sends a response (please use `@Res` for sending a response, as it is more flexible). They're supposed to be fairly lightweight and not call the database directly; however, nearly all of our endpoints are implemented incorrectly where the entire endpoint is written in the controller. Integration tests test these.

`service` - These define methods that make calls to the database. Unit tests test these.

`entity` - These define the database schema. If you make any changes to these, be sure to make a migration (see `DEVELOPING.md`) 

`redis` - A fast, in-memory database that we use for caching frequently accessed data. Sometimes, there can be issues where the redis database is not in sync with the actual database. If this happens, follow these steps to flush the redis cache:
1. Open the redis container in docker desktop and go to the "Exec" tab
2. Run `redis-cli` to open the redis command line
3. Run `flushall` to flush the cache


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

# TODO

## For the whole project

- Maybe check out the "issues" page on github
- Do a ctrl+shift+f for "TODO" and do all TODOs

## For this document
- Add a list of TODOs 
- Add more technologies
- Merge stuff from DEVELOPING.md