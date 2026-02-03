import { ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGuard } from './websocket.guard';
import { ERROR_MESSAGES } from '@koh/common';
import {
  WsForbiddenException,
  WsUnauthorizedException,
} from '../../websocket/websocket.exception';

@Injectable()
export class WsJwtAuthGuard extends WebSocketGuard {
  constructor(private jwtService: JwtService) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(
    client: Socket,
    _: any,
    pattern: string,
    skipPath?: boolean,
  ): boolean {
    // Check if token is limited to specific endpoints
    const user = this.precheck(client);
    if (!user) {
      throw new WsUnauthorizedException(
        ERROR_MESSAGES.webSocket.jwt.userNotFound,
      );
    }
    const pathOrPaths: string | string[] = user.restrictPaths;
    if (!pathOrPaths || skipPath) {
      return user;
    }

    let isAllowedOnPath: boolean;
    if (Array.isArray(pathOrPaths)) {
      isAllowedOnPath = false;
      for (const path of pathOrPaths) {
        if (path.startsWith('r')) {
          const regex = new RegExp(path.substring(1), 'i');
          if (regex.test(pattern)) {
            isAllowedOnPath = true;
            break;
          }
        } else {
          if (pattern == path) {
            isAllowedOnPath = true;
            break;
          }
        }
      }
    } else {
      if (pathOrPaths.startsWith('r')) {
        const regex = new RegExp(pathOrPaths.substring(1), 'i');
        isAllowedOnPath = regex.test(pattern);
      } else {
        isAllowedOnPath = pattern == (pathOrPaths as string);
      }
    }

    if (!isAllowedOnPath) {
      throw new WsForbiddenException(
        ERROR_MESSAGES.webSocket.jwt.disallowedPattern,
      );
    }

    return user;
  }

  precheck(client: Socket): any {
    const handshake = client.handshake;
    const cookie = handshake.headers.cookie;

    if (!cookie) {
      throw new WsUnauthorizedException(
        ERROR_MESSAGES.webSocket.jwt.missingAuthHeader,
      );
    }

    const split = cookie.split(';');
    const cookies = split.map((v) => {
      const [key, value] = v.trim().split('=') as [string, string];
      return { key, value };
    });
    const authCookie =
      cookies.find((c) => c.key == 'auth_token') ??
      cookies.find((c) => c.key == 'lti_auth_token');
    if (!authCookie) {
      throw new WsUnauthorizedException(
        ERROR_MESSAGES.webSocket.jwt.missingAuthToken,
      );
    }
    if (!authCookie.value) {
      // latter half of string is empty
      throw new WsUnauthorizedException(
        ERROR_MESSAGES.webSocket.jwt.malformedToken,
      );
    }

    try {
      client['user'] = this.jwtService.verify(authCookie.value);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      throw new WsUnauthorizedException(
        ERROR_MESSAGES.webSocket.jwt.invalidToken,
      );
    }

    return client['user'];
  }
}
