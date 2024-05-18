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
