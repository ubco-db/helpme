import { ExecutionContext, Injectable } from '@nestjs/common';
import { WebSocketGuard } from './websocket.guard';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import {
  WebSocketException,
  WsUnauthorizedException,
} from '../../websocket/websocket.exception';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsJwtAuthGuard } from './ws-jwt-auth.guard';
import { WsApiKeyGuard } from './ws-api-key.guard';

@Injectable()
export class WsGeneralGuard extends WebSocketGuard {
  private wsJwtAuthGuard: WsJwtAuthGuard;
  private wsApiKeyGuard: WsApiKeyGuard;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    super();
    this.wsApiKeyGuard = new WsApiKeyGuard(configService);
    this.wsJwtAuthGuard = new WsJwtAuthGuard(jwtService);
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(client: Socket): boolean {
    let passedAuth = false,
      passedApi = false;
    const failed: string[] = [];
    try {
      passedAuth = this.wsJwtAuthGuard.handleRequest(client, {} as any, '');
    } catch (err: any) {
      if (err instanceof WebSocketException) {
        failed.push(err.message);
      }
    }
    try {
      passedApi = this.wsApiKeyGuard.handleRequest(client);
    } catch (err: any) {
      if (err instanceof WebSocketException) {
        failed.push(err.message);
      }
    }
    if (!passedApi && !passedAuth) {
      throw new WsUnauthorizedException(
        failed.length > 0 ? failed.join(' & ') : undefined,
      );
    }
    return true;
  }
}
