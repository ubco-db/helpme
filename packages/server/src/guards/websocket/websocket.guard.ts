import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';

export abstract class WebSocketGuard<TData = any> implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ws = context.switchToWs();
    return this.handleRequest(
      ws.getClient<Socket>(),
      ws.getData<TData>(),
      ws.getPattern(),
    );
  }

  abstract handleRequest(
    client: Socket,
    data: TData,
    pattern: string,
  ): boolean | Promise<boolean> | Observable<boolean>;
}
