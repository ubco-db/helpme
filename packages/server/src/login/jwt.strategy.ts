import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { APP_AUTH_KIND, getAppAuthPayload } from './auth-token';

/**
 * The app session cookie takes precedence, but a cookie that is not an
 * app-auth token on inspection (e.g. a stale token issued before the `kind`
 * claim existed) must not shadow a fresh LTI session cookie. Whichever token
 * is selected is still fully verified by the strategy (signature, expiry) and
 * by validate (purpose); this inspection alone never grants access.
 */
function selectAuthCookie(
  req: Request,
  jwtService: JwtService,
): string | undefined {
  const appToken = req.cookies['auth_token'];
  const ltiToken = req.cookies['lti_auth_token'];
  if (appToken === undefined || ltiToken === undefined) {
    return appToken ?? ltiToken;
  }

  const payload: unknown = jwtService.decode(appToken);
  const kind =
    typeof payload === 'object' && payload !== null
      ? (payload as { kind?: unknown }).kind
      : undefined;
  return kind === APP_AUTH_KIND ? appToken : ltiToken;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, jwtService: JwtService) {
    super({
      jwtFromRequest: (req: Request) => selectAuthCookie(req, jwtService),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  validate(payload: unknown): Record<string, unknown> {
    return getAppAuthPayload(payload);
  }
}
