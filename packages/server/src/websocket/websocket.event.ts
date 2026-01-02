import { Server } from 'socket.io';

export class WebSocketSubscriber<TParams extends object = object> {
  constructor(
    public socketId: string,
    public params: TParams,
  ) {}

  checkMatch(params: Partial<TParams>): boolean {
    for (const k in this.params) {
      if (!(k in params) || this.params[k] !== params[k]) {
        return false;
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
    this.subscribers = [
      ...this.subscribers,
      new WebSocketSubscriber(clientId, params),
    ];
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
      let matchParams = true;
      for (const k in params) {
        if ((subscriber.params as any)[k] !== params[k]) {
          matchParams = false;
          break;
        }
      }
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
        const match = subscriber.checkMatch(params);
        if (!match) return;
        socket.emit(this.postEvent, data);
      });
    });
  }
}
