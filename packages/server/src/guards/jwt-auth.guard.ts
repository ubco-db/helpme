import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const initial = await super.canActivate(context);
    if (!initial) {
      return false;
    }

    // Check if token is limited to specific endpoints
    const request = context.switchToHttp().getRequest();
    const requestPath: string = request.path;

    const pathOrPaths: (string | RegExp) | (string | RegExp)[] =
      request.user.restrictPaths;
    if (!pathOrPaths) return true;

    if (Array.isArray(pathOrPaths)) {
      for (const path of pathOrPaths) {
        if (path instanceof RegExp) {
          if (!requestPath.match(path)) {
            return false;
          }
        } else {
          if (requestPath != path) {
            return false;
          }
        }
      }
      return true;
    }

    return (
      (pathOrPaths instanceof RegExp &&
        requestPath.match(pathOrPaths) != null) ||
      requestPath == (pathOrPaths as string)
    );
  }
}
