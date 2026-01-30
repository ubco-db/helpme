import { io, Socket } from 'socket.io-client';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { EventEmitter } from 'node:events';
import { WsException } from '@nestjs/websockets';
import { ERROR_MESSAGES } from '@koh/common';

@Injectable()
export class ClientSocketService {
  private socket: Socket;
  public readonly receiver: EventEmitter;
  private subscriptions: string[];

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
    this.subscriptions = [];
    this.receiver = new EventEmitter();
    this.socket.onAny((event, ...args) => {
      this.receiver.emit(event, args);
    });
    (async () => {
      await this.connect();
    })().catch((err) => {
      console.error(err);
    });
  }

  private async restoreSubscriptions() {
    for (const sub of this.subscriptions) {
      try {
        await this.subscribe(JSON.parse(sub));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (ignored) {}
    }
  }

  async connect() {
    const initialId = this.socket.id;
    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve(true);
        return;
      }

      this.socket.on('connect', () => {
        if (this.socket.id !== initialId) {
          this.restoreSubscriptions();
        }
        resolve(true);
      });

      this.socket.connect();

      setTimeout(() => {
        reject(new Error('Connection attempt timed out'));
      }, 5000);
    });
  }

  async expectReply<TResult>(
    subscription: { event: string; args: object },
    listenFor: string,
    callback: (result: TResult) => Promise<void>,
    onError?: (result: any, err: any) => void,
    timeout: number = 30000, // default timeout of 30 seconds
  ) {
    let listener;
    const cleanup = async () => {
      if (listener) {
        this.receiver.off(listenFor, listener);
      }
      try {
        await this.unsubscribe(subscription);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (ignored) {}
    };
    let t: any;
    await this.subscribe(subscription);

    return new Promise<void>((resolve, reject) => {
      listener = async (result: TResult) => {
        try {
          result = Array.isArray(result) ? result[0] : result;
          await callback(result);
          resolve();
        } catch (err) {
          if (onError) {
            onError(result, err);
            reject(err);
          }
        } finally {
          if (t) {
            clearTimeout(t);
          }
          await cleanup();
        }
      };
      this.receiver.on(listenFor, listener);

      t = setTimeout(async () => {
        reject(new WsException(ERROR_MESSAGES.webSocket.operations.timeout));
        clearTimeout(t);
        await cleanup();
      }, timeout);
    });
  }

  async subscribe(subscription: { event: string; args: object }) {
    const key = JSON.stringify(subscription);
    const subscribed = await this.emitWithAck(
      subscription.event,
      subscription.args,
    );
    const result = Array.isArray(subscribed) ? subscribed[0] : subscribed;

    if (isObject(result) && 'error' in result) {
      throw result;
    }
    if (!this.subscriptions.includes(key)) {
      this.subscriptions.push(key);
    }
  }

  async unsubscribe(subscription: {
    event: string;
    args: object;
  }): Promise<void> {
    const key = JSON.stringify(subscription);
    const unsubscribed = await this.socket.emitWithAck(
      subscription.event + '/unsubscribe',
      subscription.args,
    );
    const result = Array.isArray(unsubscribed) ? unsubscribed[0] : unsubscribed;
    if (isObject(result) && 'error' in result) {
      throw result;
    }
    this.subscriptions = this.subscriptions.filter((s) => s !== key);
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
