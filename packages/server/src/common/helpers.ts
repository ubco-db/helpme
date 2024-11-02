import { Request } from 'express';

export function getCookie(req: Request, cookieName: string): string {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies: string[] = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name.trim() === cookieName) {
      return value;
    }
  }
}

// This is code from common index.ts. It doesn't always work in there since it's not always initialized for some reason.
// So I had to put this in the server as well, that way sentry can run.
export const PROD_URL = 'https://coursehelp.ubc.ca';
const domain = (): string | false =>
  process.env.DOMAIN ||
  (typeof window !== 'undefined' && window?.location?.origin);
export const getEnv = (): 'production' | 'dev' => {
  switch (domain()) {
    case PROD_URL:
      return 'production';
    default:
      return 'dev';
  }
};
export const isProd = (): boolean => domain() === PROD_URL;
