import { io, Socket } from 'socket.io-client';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { isObject } from '@nestjs/common/utils/shared.utils';

@Injectable()
export class ClientSocketService {
  private socket: Socket;

  constructor(private configService: ConfigService) {
    this.socket = io('http://localhost:3002', {
      forceNew: false,
      multiplex: true,
      reconnection: true,
      path: '/api/v1/ws',
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 5000,
      autoConnect: false,
      extraHeaders: {
        'hms-api-key': this.configService.get<string>('CHATBOT_API_KEY'),
      },
    }) as Socket;
  }

  private activeListeners: {
    [key: string]: ((data: any) => void | Promise<void>)[];
  } = {};

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve(true);
        return;
      }

      this.socket.on('connect', () => {
        resolve(true);
      });

      this.socket.connect();

      setTimeout(() => {
        reject(new Error('Connection attempt timed out'));
      }, 5000);
    });
  }

  async registerListener<TData>(
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
        await this.cleanupListener(
          listener,
          this.activeListeners[listener.event].find((l) => l == listen),
          subscription,
        );
      }
    };

    this.activeListeners[listener.event].push(listen);
    this.socket.on(listener.event, listen);

    if (subscription) {
      const subscribed = await this.emitWithAck(
        subscription.event,
        subscription.args,
      );
      if (isObject(subscribed) && 'error' in subscribed) {
        throw subscribed;
      }
    }
  }

  async cleanupListener(
    listener: { event: string },
    listenerFunction: (data: any) => any,
    subscription?: { event: string; args: object },
  ): Promise<void> {
    if (subscription) {
      const unsubscribed = await this.socket.emitWithAck(
        subscription.event + '/unsubscribe',
        subscription.args,
      );
      if (isObject(unsubscribed) && 'error' in unsubscribed) {
        throw unsubscribed;
      }
    }
    if (listener) {
      this.socket.off(listener.event, listenerFunction);
    }
  }

  async emit(event: string, args?: any): Promise<void> {
    await this.connect();
    this.socket.emit(event, args);
  }

  async emitWithAck(event: string, args?: any): Promise<any> {
    await this.connect();
    return await this.socket.emitWithAck(event, args);
  }
}
