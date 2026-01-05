import { io, Socket } from 'socket.io-client';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientSocketService {
  private socket: Socket;

  constructor(private configService: ConfigService) {
    this.socket = io({
      path: '/api/v1/ws',
      extraHeaders: {
        'hms-api-key': this.configService.get<string>('CHATBOT_API_KEY'),
      },
    }) as Socket;
  }

  private activeListeners: {
    [key: string]: ((data: any) => void | Promise<void>)[];
  } = {};

  registerListener<TData>(
    listener: {
      event: string;
      callback: (data: TData) => void | Promise<void>;
    },
    subscription?: { event: string; args: object },
  ) {
    if (!this.activeListeners[listener.event]) {
      this.activeListeners[listener.event] = [];
    }
    const listen = async (data: TData) => {
      try {
        await listener.callback(data);
      } finally {
        this.cleanupListener(
          listener,
          this.activeListeners[listener.event].find((l) => l == listen),
          subscription,
        );
      }
    };
    this.activeListeners[listener.event].push(listen);
    this.socket.on(listener.event, listen);
    if (subscription) {
      this.socket.emit(subscription.event, subscription.args);
    }
  }

  cleanupListener(
    listener: { event: string },
    listenerFunction: (data: any) => any,
    subscription?: { event: string; args: object },
  ): void {
    if (subscription) {
      this.socket.emit(subscription.event + '/unsubscribe', subscription.args);
    }
    if (listener) {
      this.socket.off(listener.event, listenerFunction);
    }
  }

  emit(event: string, args?: any): any {
    return this.socket.emit(event, args);
  }
}
