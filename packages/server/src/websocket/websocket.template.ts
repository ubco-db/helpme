import { Inject, Injectable } from '@nestjs/common';
import {
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebSocketEvent } from 'websocket/websocket.event';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import crypto from 'crypto';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebSocketTemplate implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    @Inject(CACHE_MANAGER)
    protected cacheManager: Cache,
  ) {}

  @WebSocketServer()
  protected server: Server;
  protected events: { [key: string]: WebSocketEvent } = {};

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'CLEAR_SUBSCRIBERS' })
  async removeHangingSubscribers() {
    const ids = await this.server
      .fetchSockets()
      .then((sockets) =>
        sockets.map((s) => s.id).reduce((p, c) => [...p, c], []),
      );
    for (const event of Object.values(this.events)) {
      event.filterSubscribers(ids);
    }
  }

  afterInit(server: Server): any {
    this.server = server;
  }

  handleDisconnect(client: Socket): any {
    for (const event of Object.values(this.events)) {
      event.unsubscribe(client.id);
    }
  }

  async getUniqueId(): Promise<string> {
    let id: string | undefined = undefined;
    do {
      id = crypto.randomBytes(32).toString('hex');
    } while (await this.cacheManager.get(id));
    await this.cacheManager.set(id, true, 30 * 60 * 1000); // persist for 30 min
    return id;
  }
}
