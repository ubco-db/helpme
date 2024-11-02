import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export const PROD_URL = 'https://coursehelp.ubc.ca';

// This is a sentry-made file. Idk what it does, probably don't touch it.
if (process.env.DOMAIN == PROD_URL) {
  console.log('Initializing Sentry on Server');
  Sentry.init({
    dsn: 'https://f61b5e5123c15b571f04c69fcf8702f4@o4508000643252224.ingest.us.sentry.io/4508000797392896',
    integrations: [nodeProfilingIntegration()],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions

    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}
