import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtAuthGuard } from '../../guards/websocket/ws-jwt-auth.guard';
import { WsApiKeyGuard } from '../../guards/websocket/ws-api-key.guard';
import { WebSocketEvent } from '../../websocket/websocket.event';
import {
  WebSocketException,
  WsNotFoundException,
} from '../../websocket/websocket.exception';
import { Cache } from 'cache-manager';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ChatbotEventParams,
  ChatbotResultEventName,
  ChatbotResultEvents,
  isProd,
} from '@koh/common';

@Injectable()
export class ChatbotResultGateway extends WebsocketGateway {
  constructor(
    protected configService: ConfigService,
    protected jwtService: JwtService,
    @Inject(CACHE_MANAGER) protected cacheManager: Cache,
  ) {
    super(configService, jwtService, cacheManager);
  }

  afterInit(server: Server): any {
    super.afterInit(server);
    this.events[ChatbotResultEvents.GET_RESULT] = new WebSocketEvent<
      ChatbotEventParams,
      any
    >(this.server, ChatbotResultEvents.POST_RESULT);
  }

  handleDisconnect(client: Socket): any {
    super.handleDisconnect(client);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage(ChatbotResultEvents.GET_RESULT)
  async subscribeResultEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: [{ resultId: string; type: ChatbotResultEventName }],
  ): Promise<boolean> {
    if (!isProd()) {
      this.logger.debug(
        `Client ${client.id} subscribe request: ${JSON.stringify(body)}.`,
      );
    }
    const { resultId, type } = body[0];
    if (!this.events[ChatbotResultEvents.GET_RESULT]) {
      throw new WsNotFoundException();
    }

    this.events[ChatbotResultEvents.GET_RESULT].subscribe(client.id, {
      type,
      resultId,
    });
    if (!isProd()) {
      this.logger.debug(`Client ${client.id} subscribe success.`);
    }
    client.emit(ChatbotResultEvents.GET_RESULT, {
      success: true,
    });
    return true;
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage(ChatbotResultEvents.GET_RESULT + '/unsubscribe')
  async unsubscribeResultEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: [{ resultId: string; type: ChatbotResultEventName }],
  ): Promise<boolean> {
    if (!isProd()) {
      this.logger.debug(
        `Client ${client.id} unsubscribe: ${JSON.stringify(body)}.`,
      );
    }
    const { resultId, type } = body[0];
    if (!this.events[ChatbotResultEvents.GET_RESULT]) {
      throw new WsNotFoundException();
    }
    this.events[ChatbotResultEvents.GET_RESULT].unsubscribe(client.id, {
      resultId,
      type,
    });
    if (!isProd()) {
      this.logger.debug(`Client ${client.id} unsubscribe success.`);
    }
    return true;
  }

  @UseGuards(WsApiKeyGuard)
  @SubscribeMessage(ChatbotResultEvents.POST_RESULT)
  async handlePostResultEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { resultId: string; type: ChatbotResultEventName; data: any },
  ): Promise<any> {
    if (!isProd()) {
      this.logger.debug(
        `Client ${client.id} post data: ${JSON.stringify(body)}.`,
      );
    }
    const { resultId, type, data } = body;
    if (!this.events[ChatbotResultEvents.GET_RESULT]) {
      throw new WsNotFoundException();
    }
    try {
      this.events[ChatbotResultEvents.GET_RESULT].post(
        { type, resultId },
        data,
      );
      if (!isProd()) {
        this.logger.debug(`Client ${client.id} post data success!`);
      }
      return true;
    } catch (error) {
      if (!isProd()) {
        this.logger.debug(
          `Client ${client.id} post data failure: ${JSON.stringify(error)}.`,
        );
      }
      if (error instanceof HttpException) {
        throw new WebSocketException(error.getStatus(), error.message);
      } else {
        throw new WebSocketException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          error.message,
        );
      }
    }
  }
}
