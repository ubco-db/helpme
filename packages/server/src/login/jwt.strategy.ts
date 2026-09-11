import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { getAppAuthPayload } from './auth-token';

/**
 * The app session cookie takes precedence, but a broken app cookie (expired,
 * bad signature, or not a valid app-auth token) must not shadow a fresh LTI
 * session cookie. When both cookies are present, the app cookie is verified
 * here against the same JWT secret configured for LoginModule's JwtService
 * (including the purpose/user check), and any failure selects the LTI cookie.
 * Whichever token is selected is then verified again by the strategy
 * (signature, expiry) and validate (purpose); a failed selection never
 * grants access on its own.
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

  try {
    getAppAuthPayload(jwtService.verify(appToken));
    return appToken;
  } catch {
    return ltiToken;
  }
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
