## postgres.env (place in packages/server)

###### POSTGRES_USER

**Purpose:** username of the root user for the postgres db

**How to get:** Safe to leave it as is if you're just testing. Can change to something less-obvious on prod

###### POSTGRES_PASSWORD

**Purpose:** password of the root user for the postgres db

**How to get:** Safe to leave it as is if you're just testing. PLEASE change to something less-obvious on prod

###### POSTGRES_NONROOT_USER

**Purpose:** username of the non-root user for the postgres db

**How to get:** Safe to leave it as is if you're just testing. Can change to something less-obvious on prod

###### POSTGRES_NONROOT_PASSWORD

**Purpose:** password of the non-root user for the postgres db
**How to get:** Safe to leave it as is if you're just testing. PLEASE change to something less-obvious on prod


## server .env (place in packages/server)

###### TESTDBPASS

**Purpose:** Password for the test database (?)

**How to get:** Probably safe to leave it as is.

###### PUBLICKEY

**Purpose:** used for web notification service (for notifying users where they are in the queue, if someone joined the queue, etc.) 

**How to get:** probably fine to leave as is. 

###### PRIVATEKEY

**Purpose:** same as PUBLICKEY

**How to get:** probably fine to leave as is. 

###### EMAIL

**Purpose:** same as PUBLICKEY 

**How to get:** probably fine to leave as is. 

###### JWT_SECRET

**Purpose:** used to encrypt (?) JSON Web Tokens 

**How to get:** probably fine to leave as is. 

###### DOMAIN

**Purpose:** Used to identify the URL of the server.

**How to get:** probably fine to leave as is if you're just testing.  

###### UPLOAD_LOCATION

**Purpose:** Where images get uploaded on the server

**How to get:** probably fine to leave as is. 

###### NODE_ENV

**Purpose:** used to determine if the server is in development or production mode (in development mode, some things, like the localhost:3000/dev route are enabled)

**How to get:** leave as `development` if you're just testing. If you are actually hosting the server, change to `production`.

###### REDIS_HOST

**Purpose:** name of the redis server (should be same as the name of the one in `docker-compose.yml` probably). 

**How to get:** probably fine to leave as is. 

###### GOOGLE_CLIENT_ID

**Purpose:** used for "Log in with Google" feature. Not needed if you don't plan on using it.

**How to get:** Can get it from https://developers.google.com/identity/sign-in/web/sign-in 

###### GOOGLE_REDIRECT_URI

**Purpose:** same as GOOGLE_CLIENT_ID

**How to get:** `domain` + `/api/v1/auth/callback/google` (e.g. `http://localhost:3000/api/v1/auth/callback/google`)

###### GOOGLE_CLIENT_SECRET

**Purpose:** same as GOOGLE_CLIENT_ID

**How to get:**  same as GOOGLE_CLIENT_ID

###### PRIVATE_RECAPTCHA_SITE_KEY

**Purpose:** for recaptcha (bot protection) for creating an account/ logging in

**How to get:** obtain google recaptcha keys from https://www.google.com/recaptcha/admin/create

###### GMAIL_USER

**Purpose:** Used for sending out verification or forgot password emails

**How to get:** use any gmail account (e.g. coolemail@gmail.com)

###### GMAIL_PASSWORD

**Purpose:** same as GMAIL_USER

**How to get:** This is NOT the password of the gmail account! You will need to create an app password: https://knowledge.workspace.google.com/kb/how-to-create-app-passwords-000009237  (example app password: asdfghjkasdfghjk)

###### SENTRY_AUTH_TOKEN

**Purpose:** Sentry captures errors (e.g. 500 level errors) and sends it to its own site. This is needed in order for your environment to capture these errors. This is also needed to get the code source maps (code is normally minified and made unreadable, source maps are just the base code). If you leave it empty, it should be fine.

**How to get:** Ask me (Adam) and I can provide you with mine. NOTE: This is a different SENTRY_AUTH_TOKEN from the frontend one.

## client .env (place in packages/app)

###### NEXT_PUBLIC_RECAPTCHA_SITE_KEY

**Purpose:** for recaptcha (bot protection) for creating an account/ logging in

**How to get:** obtain google recaptcha keys from https://www.google.com/recaptcha/admin/create

###### SENTRY_AUTH_TOKEN

**Purpose:** Sentry captures errors (client-side errors, like doing undefined.length) and sends it to its own site. This is needed in order for your environment to capture these errors. It's also used for authentication when uploading source maps (source code that's not minified). If you leave it empty, it should be fine.

**How to get:** Ask me (Adam) and I can provide you with mine. NOTE: This is a different SENTRY_AUTH_TOKEN from the server one.
