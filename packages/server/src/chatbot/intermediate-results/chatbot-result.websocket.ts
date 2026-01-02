import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ParseEnumPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtAuthGuard } from '../../guards/websocket/ws-jwt-auth.guard';
import { WsChatbotApiKeyGuard } from '../../guards/websocket/ws-chatbot-api-key.guard';
import { WebSocketEvent } from '../../websocket/websocket.event';
import {
  WebSocketException,
  WsNotFoundException,
} from '../../websocket/websocket.exception';
import { Cache } from 'cache-manager';
import { WebSocketTemplate } from '../../websocket/websocket.template';

export enum ChatbotResultEvents {
  GET_RESULT = 'chatbot/get_result',
  POST_RESULT = 'chatbot/post_result',
  RESULT_RECEIVED = 'chatbot/received_result',
}

export enum ChatbotResultEventName {
  ADD_AGGREGATE = 'add_aggregate_complete',
  UPDATE_AGGREGATE = 'update_aggregate_complete',
  ADD_CHUNK = 'add_chunk_complete',
  UPDATE_CHUNK = 'update_chunk_complete',
  DOCUMENT_QUERIES = 'query_generation_complete',
}

export type ChatbotResultEventArgs = {
  returnMessage: ChatbotResultEvents;
  type: ChatbotResultEventName;
};

export type ChatbotEventParams = {
  type: ChatbotResultEventName;
  resultId: string;
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatbotResultWebSocket extends WebSocketTemplate {
  constructor(@Inject() protected cacheManager: Cache) {
    super(cacheManager);
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
    @MessageBody('id') resultId: number,
    @MessageBody('type', new ParseEnumPipe(ChatbotResultEventName))
    type: ChatbotResultEventName,
  ): Promise<boolean> {
    if (!this.events[ChatbotResultEvents.GET_RESULT]) {
      throw new WsNotFoundException();
    }
    this.events[ChatbotResultEvents.GET_RESULT].subscribe(client.id, {
      type,
      resultId,
    });
    return true;
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage(ChatbotResultEvents.GET_RESULT + '/unsubscribe')
  async unsubscribeResultEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody('id') resultId: number,
    @MessageBody('type', new ParseEnumPipe(ChatbotResultEventName))
    type: ChatbotResultEventName,
  ): Promise<boolean> {
    if (!this.events[ChatbotResultEvents.GET_RESULT]) {
      throw new WsNotFoundException();
    }
    this.events[ChatbotResultEvents.GET_RESULT].unsubscribe(client.id, {
      resultId,
      type,
    });
    return true;
  }

  @UseGuards(WsChatbotApiKeyGuard)
  @SubscribeMessage(ChatbotResultEvents.POST_RESULT)
  async handlePostResultEvent(
    @MessageBody('id') resultId: number,
    @MessageBody('type', new ParseEnumPipe(ChatbotResultEventName))
    type: ChatbotResultEventName,
    @MessageBody('resultBody') resultBody: any,
  ): Promise<any> {
    if (!this.events[ChatbotResultEvents.GET_RESULT]) {
      throw new WsNotFoundException();
    }
    try {
      this.events[ChatbotResultEvents.GET_RESULT].post(
        { type, resultId },
        resultBody,
      );
      return true;
    } catch (error) {
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
