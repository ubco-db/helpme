import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _: any, context: ExecutionContext): any {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    // Check if token is limited to specific endpoints
    const request = context.switchToHttp().getRequest();
    const requestPath: string = request.path;

    const pathOrPaths: string | string[] = user.restrictPaths;
    if (!pathOrPaths) return user;

    let isAllowedOnPath: boolean;
    if (Array.isArray(pathOrPaths)) {
      isAllowedOnPath = false;
      for (const path of pathOrPaths) {
        if (path.startsWith('r')) {
          const regex = new RegExp(path.substring(1), 'i');
          if (regex.test(requestPath)) {
            isAllowedOnPath = true;
            break;
          }
        } else {
          if (requestPath == path) {
            isAllowedOnPath = true;
            break;
          }
        }
      }
    } else {
      if (pathOrPaths.startsWith('r')) {
        const regex = new RegExp(pathOrPaths.substring(1), 'i');
        isAllowedOnPath = regex.test(requestPath);
      } else {
        isAllowedOnPath = requestPath == (pathOrPaths as string);
      }
    }

    if (!isAllowedOnPath) {
      throw new ForbiddenException();
    }

    return user;
  }
}
