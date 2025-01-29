// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import { isProd } from './middlewareType'

if (isProd()) {
  console.log('Initializing Sentry on frontend: sentry.edge.config.ts')
  Sentry.init({
    dsn: 'https://02886ace32d0ae13a1bc81482aa1bdef@o4508000643252224.ingest.us.sentry.io/4508000651116544',

    integrations: [
      Sentry.captureConsoleIntegration({ levels: ['warn', 'error'] }),
    ],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  })
}
