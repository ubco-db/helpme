// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import { isProd } from './middlewareType'

if (isProd()) {
  console.log('Initializing Sentry on frontend: sentry.server.config.ts')
  Sentry.init({
    dsn: 'https://02886ace32d0ae13a1bc81482aa1bdef@o4508000643252224.ingest.us.sentry.io/4508000651116544',

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })
}
