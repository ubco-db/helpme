import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { each } from 'async';
import { serialize } from 'class-transformer';
import { Response } from 'express';
import { ERROR_MESSAGES } from '@koh/common';
import Redis from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';

/**
 * A connection to a particular frontend client
 */
interface Connection {
  res: Response;
  cleanup: () => Promise<void>;
}

interface RedisClientInfo<T> {
  clientId: number;
  metadata: T;
}
/**
 * T is metadata associated with each Client
 *
 * Low level abstraction for sending SSE to "rooms" of clients.
 * Probably don't use this directly, and wrap it in a service specific to that event source
 *
 * This handles when there's multiple backend instances by assigning unique client ids to each connection.
 * When one instance wants to send to a client, it publishes to a Redis channel for the client.
 * All instances listen to Redis, and if they are the one managing that client, they send the msg.
 *
 * Rooms with client metadata are also maintained in Redis key/value store.
 */
@Injectable()
export class SSEService<T> implements OnModuleDestroy {
  // Clients connected to this instance of the backend
  private directConnnections: Record<string, Connection> = {};

  constructor(private readonly redisService: RedisService) {
    const redisSub = this.redisService.getClient('sub');

    // If channel is managed by this instance, send the message to the Response object.
    redisSub.on('message', (channel, message) => {
      const id = /sse::client-(\d+)/.exec(channel);
      if (id && id[1] in this.directConnnections) {
        this.directConnnections[id[1]].res.write(`data: ${message}\n\n`);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup all direct connections by removing them from the rooms in redis.
    await each(Object.values(this.directConnnections), async (conn) => {
      await conn.cleanup().catch((err) => {
        console.error(ERROR_MESSAGES.sseService.cleanupConnection);
        console.error(err);
      });
    }).catch((err) => {
      console.error(ERROR_MESSAGES.sseService.moduleDestroy);
      console.error(err);
    });
  }

  /**
   * Get redis channel name from client id
   */
  private idToChannel(clientId: number) {
    return `sse::client-${clientId}`;
  }

  /** Add a client to a room */
  async subscribeClient(
    room: string,
    res: Response,
    metadata: T,
  ): Promise<void> {
    const redisSub = this.redisService.getClient('sub');
    const redis = this.redisService.getClient('db');

    // Keep track of responses so we can send sse through them
    const clientId = await redis.incr('sse::client::id').catch((err) => {
      console.error(ERROR_MESSAGES.sseService.clientIdSubscribe);
      console.error(err);
    });
    // Subscribe to the redis channel for this client

    if (!clientId) {
      throw new Error(ERROR_MESSAGES.sseService.clientIdNotFound);
    }

    await redisSub.subscribe(this.idToChannel(clientId)).catch((err) => {
      console.error(ERROR_MESSAGES.sseService.subscribe);
      console.error(err);
    });

    // Add to room
    const clientInfo = JSON.stringify({
      clientId,
      metadata: metadata,
    } as RedisClientInfo<T>);
    await redis.sadd(room, clientInfo).catch((err) => {
      console.error(err);
    });

    // Keep track of response object in direct connections
    this.directConnnections[clientId] = {
      res,
      cleanup: async () => {
        // Remove from the redis room
        await redis.srem(room, clientInfo).catch((err) => {
          console.error(ERROR_MESSAGES.sseService.removeFromRoom);
          console.error(err);
        });
        await redisSub.unsubscribe(this.idToChannel(clientId)).catch((err) => {
          console.error(ERROR_MESSAGES.sseService.unsubscribe);
          console.error(err);
        });
        res.end();
      },
    };

    // Ack so frontend knows we're connected
    res.write('\n');

    // Remove dead connections!
    res.socket.on('end', async () => {
      await this.directConnnections[clientId].cleanup().catch((err) => {
        console.error(ERROR_MESSAGES.sseService.directConnections);
        console.error(err);
      });
      delete this.directConnnections[clientId];
    });
  }

  /** Send some data to everyone in a room */
  async sendEvent<D>(
    room: string,
    payload: (metadata: T) => Promise<D>,
  ): Promise<void> {
    const redisPub = this.redisService.getClient('pub');
    const redis = this.redisService.getClient('db');

    const roomInfo = await redis.smembers(room).catch((err) => {
      console.error(ERROR_MESSAGES.sseService.roomMembers);
      console.error('problem room: ' + room);
      console.error('problem payload: ' + payload.toString());
      console.error(err);
    });

    if (room && roomInfo) {
      const clients: RedisClientInfo<T>[] = roomInfo.map((s) => JSON.parse(s));
      await each(clients, async ({ clientId, metadata }) => {
        const toSend = serialize(
          await payload(metadata).catch((err) => {
            console.error(ERROR_MESSAGES.sseService.serialize);
            console.error(err);
          }),
        );
        await redisPub
          .publish(this.idToChannel(clientId), toSend)
          .catch((err) => {
            console.error(ERROR_MESSAGES.sseService.publish);
            console.error(err);
          });
      });
    }
  }
}
