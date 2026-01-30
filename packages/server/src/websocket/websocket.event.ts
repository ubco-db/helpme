import { Server } from 'socket.io';

export class WebSocketSubscriber<TParams extends object = object> {
  constructor(
    public socketId: string,
    public params: TParams,
  ) {}

  checkMatch(params: Partial<TParams>, exclusive?: boolean): boolean {
    for (const k in this.params) {
      if (!(k in params)) {
        if (exclusive) {
          return false;
        }
        continue;
      }
      const array = Array.isArray(this.params[k])
        ? (this.params[k] as any[])
        : undefined;
      if (array) {
        const a2 = Array.isArray(params[k]) ? (params[k] as any[]) : undefined;
        if (a2) {
          const shared = array.filter((v) => a2.includes(v));
          if (shared.length !== array.length) {
            return false;
          }
        } else {
          if (!array.includes(params[k])) {
            return false;
          }
        }
      } else {
        if (
          Array.isArray(params[k])
            ? !(params[k] as any[]).includes(this.params[k])
            : this.params[k] !== params[k]
        ) {
          return false;
        }
      }
    }
    return true;
  }
}

export class WebSocketEvent<TParams extends object = object, TData = any> {
  private subscribers: WebSocketSubscriber[] = [];

  constructor(
    private server: Server,
    private postEvent: string,
  ) {}

  subscribe(clientId: string, params: TParams) {
    const existsIndex = this.subscribers.findIndex(
      (s) => s.socketId === clientId,
    );
    if (existsIndex >= 0) {
      this.subscribers[existsIndex].params = params;
      return;
    }
    const newSub = new WebSocketSubscriber(clientId, params);
    this.subscribers = [...this.subscribers, newSub];
  }

  unsubscribe(clientId: string, params?: Partial<TParams>) {
    this.subscribers = this.subscribers.filter((subscriber) => {
      const isNotSub = subscriber.socketId !== clientId;
      if (isNotSub) {
        return isNotSub;
      }
      if (!subscriber.params || !params || Object.keys(params).length === 0) {
        return false;
      }
      const matchParams = subscriber.checkMatch(params, false);
      return !matchParams;
    });
  }

  filterSubscribers(include: string[]) {
    this.subscribers = this.subscribers.filter((subscriber) =>
      include.includes(subscriber.socketId),
    );
  }

  getSubscribers(): WebSocketSubscriber[] {
    return this.subscribers;
  }

  post(params: Partial<TParams>, data: TData) {
    this.server.sockets.fetchSockets().then((sockets) => {
      sockets.forEach((socket) => {
        const subscriber = this.subscribers.find(
          (s) => s.socketId === socket.id,
        );
        if (!subscriber) return;
        const match = subscriber.checkMatch(params, true);

        if (!match) return;
        socket.emit(this.postEvent, {
          params: params,
          data: data,
        });
      });
    });
  }
}
