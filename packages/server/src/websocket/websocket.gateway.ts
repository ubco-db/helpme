import { Inject, Injectable, Logger, UseFilters } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, ServerOptions, Socket } from 'socket.io';
import { WebSocketEvent } from 'websocket/websocket.event';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WebSocketException } from './websocket.exception';
import { isProd } from '@koh/common';
import { WsGeneralGuard } from '../guards/websocket/ws-general.guard';
import { BaseWsExceptionFilter } from '../exception_filters/generic-ws-exception.filter';

export const DefaultWebSocketServerOptions = {
  cors: {
    origin: '*',
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 10 * 1000,
    skipMiddlewares: false,
  },
  path: '/api/v1/ws',
  serveClient: false,
  connectTimeout: 45000,
  cleanupEmptyChildNamespaces: true,
} as Partial<ServerOptions>;

@Injectable()
@UseFilters(new BaseWsExceptionFilter())
@WebSocketGateway(DefaultWebSocketServerOptions)
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  protected readonly logger: Logger;
  private wsGeneralGuard: WsGeneralGuard;

  constructor(
    protected configService: ConfigService,
    protected jwtService: JwtService,
    @Inject(CACHE_MANAGER)
    protected cacheManager: Cache,
  ) {
    this.wsGeneralGuard = new WsGeneralGuard(configService, jwtService);
    this.logger = new Logger(WebsocketGateway.name);
  }

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
    this.logger.debug(this.server.path());
  }

  handleConnection(client: Socket): any {
    if (!isProd()) {
      this.logger.debug(`Client ${client.id} attempting connection.`);
    }
    let passedGuard: boolean = false;
    let passedGuardError: Error = undefined;
    try {
      passedGuard = this.wsGeneralGuard.handleRequest(client);
    } catch (err: any) {
      passedGuardError = err as WebSocketException;
    }
    if (!passedGuard) {
      client.disconnect(true);
      const msg = passedGuardError?.message ?? 'Unauthorized';
      if (!isProd()) {
        this.logger.debug(
          `Client ${client.id} connection attempt failed: unauthorized (${msg})`,
        );
      }
      return false;
    }
    if (!isProd()) {
      this.logger.debug(`Client connected ${client.id}`);
    }
    return true;
  }

  handleDisconnect(client: Socket): any {
    if (!isProd()) {
      this.logger.debug(`Client disconnected ${client.id}`);
    }
    for (const event of Object.values(this.events)) {
      event.unsubscribe(client.id);
    }
    return true;
  }

  async getUniqueId(): Promise<string> {
    let id: string | undefined = undefined;
    do {
      id = crypto.randomBytes(32).toString('hex');
    } while (await this.cacheManager.get(id));
    await this.cacheManager.set(id, true, 30 * 60 * 1000); // persist for 30 min
    return id;
  }

  @SubscribeMessage('healthcheck')
  async onHealthCheck() {
    return true;
  }
}
