import { ExecutionContext, Injectable } from '@nestjs/common';
import { WebSocketGuard } from './websocket.guard';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { WsUnauthorizedException } from '../../websocket/websocket.exception';

@Injectable()
export class WsChatbotApiKeyGuard extends WebSocketGuard {
  constructor() {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(client: Socket): boolean {
    const handshake = client.handshake;
    const apiKey = handshake.headers['hms-api-key'];
    const validApiKey = process.env.CHATBOT_API_KEY;

    if (!apiKey || apiKey !== validApiKey) {
      throw new WsUnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
