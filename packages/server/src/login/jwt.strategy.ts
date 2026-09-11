import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { getAuthPayload } from './auth-token';

// A broken app cookie (expired or bad signature) must not shadow a fresh LTI session cookie; the
// app cookie is fully verified before selection, and the selected token is verified again by the strategy.
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
    getAuthPayload(jwtService.verify(appToken));
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
    return getAuthPayload(payload);
  }
}
