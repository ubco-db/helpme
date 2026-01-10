importScripts('https://cdn.socket.io/4.8.1/socket.io.min.js')

const workerInstance: SharedWorkerGlobalScope = self as any

const TIMEOUT_DEFAULT = 5000
let ports: MessagePort[] = []

function serializeResponse(data: any) {
  if (typeof data == 'boolean' || !data) {
    return data
  }
  if ('error' in data) {
    throw new Error(data.error)
  }
  return data
}

function promiseWithTimeout<T>(
  fx: (
    resolve: (value: T) => void,
    reject: (reason: Error) => void,
    clearTimeout: any,
  ) => void,
  time: number,
) {
  let timeout: any = null
  return new Promise<T>((resolve, reject) => {
    fx(resolve, reject, () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    })
    timeout = setTimeout(() => {
      reject(new Error('Request time-out'))
    }, time)
  })
}

class WebsocketClient {
  private socket: any
  private subscriptions: { [key: string]: { [key: string]: any }[] } = {}
  private healthCheck: any
  get connected(): boolean {
    return this.socket && this.socket.connected
  }

  constructor(
    private url: string,
    private opts: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.socket = io(this.url, this.opts)
    this.socket.onAny((event: any, data: any) => {
      console.log('received:', event, data)
      this.onMessage(event, data)
    })
    this.initHealthcheck()
  }

  async disable() {
    this.disconnect().then()
    this.clearHealthcheck()
  }

  clearHealthcheck() {
    if (this.healthCheck) {
      clearInterval(this.healthCheck)
    }
  }

  initHealthcheck() {
    this.clearHealthcheck()
    this.healthCheck = setInterval(async () => {
      if (this.socket.connected) {
        try {
          const result = await this.invoke('healthcheck')
          this.onMessage('healthcheck', !!result)
        } catch (_ignored) {
          this.onMessage('healthcheck', false)
        }
      }
    }, 10000)
  }

  async reconnect() {
    const subs = { ...this.subscriptions }
    this.subscriptions = {}

    await this.socket.disconnect()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.socket = io(this.url, this.opts)
    this.socket.onAny((event: any, data: any) => this.onMessage(event, data))
    await this.connect()

    if (!this.socket.connected) {
      return false
    }

    for (const key in subs) {
      for (const params of subs[key]) {
        await this.subscribe(key, params)
      }
    }

    return true
  }

  async updateHeaders(headers: { [key: string]: string }) {
    this.opts.extraHeaders = headers
    return await this.reconnect()
  }

  async updateAuth(
    auth: { [key: string]: any } | ((cb: (data: object) => void) => void),
  ) {
    this.opts.auth = auth
    return await this.reconnect()
  }

  async connect() {
    if (this.socket.connected) {
      return true
    }
    const time = this.opts?.timeout ?? 20000
    return promiseWithTimeout<boolean>((resolve, _, clearTimeout) => {
      this.socket.once('connect', () => {
        resolve(true)
        clearTimeout()
      })
      this.socket.connect()
    }, time)
  }

  async disconnect() {
    if (!this.socket.connected) {
      return true
    }
    const time = this.opts?.timeout ?? 20000
    return promiseWithTimeout<boolean>((resolve, _, clearTimeout) => {
      this.socket.once('disconnect', () => {
        resolve(true)
        clearTimeout()
      })
      this.socket.disconnect()
    }, time)
  }

  async invoke(event: string, ...args: any[]) {
    return await this.socket
      .timeout(TIMEOUT_DEFAULT)
      .emitWithAck(event, args)
      .then(serializeResponse)
  }

  async subscribe(event: string, params: { [key: string]: string }) {
    if (this.subscriptions[event]?.includes(params)) {
      return
    }

    const success = await this.invoke(event, params)

    if (success) {
      this.subscriptions[event] ??= []
      this.subscriptions[event].push(params)
    }

    return success
  }

  async unsubscribe(event?: string, params?: { [key: string]: string }) {
    if (!event) {
      const successes: { [key: string]: boolean | Error } = {}
      for (const key in this.subscriptions) {
        try {
          const success = await this.invoke(key + '/unsubscribe')
          if (success) {
            delete this.subscriptions[key]
            successes[key] = true
          } else {
            successes[key] = false
          }
        } catch (err: any) {
          successes[key] = err as Error
        }
      }
      return successes
    }
    if (!params) {
      const success = await this.invoke(event + '/unsubscribe')
      if (success) {
        delete this.subscriptions[event]
      }
      return success
    }
    const success = this.invoke(event + '/unsubscribe', params)
    const evt = this.subscriptions[event]
    if (!evt || !success) {
      return false
    }
    this.subscriptions[event].filter((v) => {
      let allMatch = true
      for (const key in params) {
        if (v[key] != undefined && v[key] !== params[key]) {
          allMatch = false
          break
        }
      }
      return !allMatch
    })
  }

  onMessage(event: string, data: any) {
    ports.forEach((port) => port.postMessage({ external_event: event, data }))
  }
}

let ws: WebsocketClient

function sendReply(
  port: MessagePort,
  success: boolean,
  message: string,
  replyTo: string,
) {
  port.postMessage({ success, message, replyTo })
}

function sendErrorMessage(port: MessagePort, message: string, replyTo: string) {
  sendReply(port, false, message, replyTo)
}

function sendSuccessMessage(
  port: MessagePort,
  message: string,
  replyTo: string,
) {
  sendReply(port, true, message, replyTo)
}

async function worker(port: MessagePort, evt: MessageEvent<any>) {
  if (evt.data == 'onclose') {
    ports = ports.filter((p) => p !== port)
    return
  }

  const { type, messageId } = evt.data
  if (!messageId || !type) {
    sendErrorMessage(port, 'Invalid arguments', '')
    return
  }
  if (type === 'socket_init' && ws) {
    sendSuccessMessage(port, 'Socket already initialized', messageId)
    return
  }
  if (type !== 'socket_init' && !ws) {
    sendErrorMessage(port, 'Socket not initialized', messageId)
    return
  }
  if (type !== 'socket_init' && type !== 'connect' && !ws.connected) {
    sendErrorMessage(port, 'Socket not connected', messageId)
    return
  }

  try {
    switch (type) {
      case 'socket_init': {
        const { url, opts, connectNow } = evt.data
        if (!url || !opts) {
          sendErrorMessage(port, 'Missing URL and/or options', messageId)
          return
        }
        ws = new WebsocketClient(evt.data.url, evt.data.opts)
        if (connectNow) {
          const result = await ws.connect()
          sendReply(
            port,
            result,
            result
              ? 'Created & connected socket'
              : 'Socket created, failed to connect',
            messageId,
          )
        } else {
          sendSuccessMessage(port, 'Created Socket', messageId)
        }
        break
      }
      case 'connect': {
        const result = await ws.connect()
        sendReply(
          port,
          result,
          result ? 'Connected' : 'Failed to connect',
          messageId,
        )
        break
      }
      case 'disconnect': {
        const result = await ws.disconnect()
        sendReply(
          port,
          result,
          result ? 'Disconnected' : 'Failed to disconnect',
          messageId,
        )
        break
      }
      case 'subscribe': {
        const { event, params } = evt.data
        if (!event) {
          sendErrorMessage(port, 'Missing event to subscribe to', messageId)
        }
        const result = await ws.subscribe(event, params)
        sendReply(
          port,
          result,
          result
            ? 'Successfully subscribed to event'
            : 'Failed to subscribe to event',
          messageId,
        )
        break
      }
      case 'unsubscribe': {
        const { event, params } = evt.data
        const result = await ws.unsubscribe(event, params)
        if (typeof result == 'object') {
          const results = Object.keys(result).map((k) => result[k])
          const successes = results.filter((v) => v === true)
          const failures = results.filter(
            (v) => v === false || v instanceof Error,
          )
          if (failures.length === 0) {
            sendReply(
              port,
              true,
              'Successfully unsubscribed from all events',
              messageId,
            )
          } else {
            sendReply(
              port,
              false,
              `Could not unsubscribe from all events: ${successes.length} succeeded, ${failures.length} failed.`,
              messageId,
            )
          }
        } else {
          sendReply(
            port,
            result,
            result
              ? 'Successfully unsubscribed from event'
              : 'Failed to unsubscribe from event',
            messageId,
          )
        }
        break
      }
      case 'setHeaders': {
        const { headers } = evt.data
        const result = await ws.updateHeaders(headers)
        sendReply(
          port,
          result,
          result
            ? 'Successfully updated headers & reconnected'
            : 'Failed to reconnect after updating headers',
          messageId,
        )
        break
      }
      case 'setAuth': {
        const { auth } = evt.data
        const result = await ws.updateAuth(auth)
        sendReply(
          port,
          result,
          result
            ? 'Successfully updated headers & reconnected'
            : 'Failed to reconnect after updating headers',
          messageId,
        )
        break
      }
    }
  } catch (err) {
    sendErrorMessage(port, JSON.stringify(err), messageId)
  }
}

workerInstance.onconnect = function (e) {
  const port = e.ports[0]
  ports.push(port)
  port.addEventListener('message', (event) => worker(port, event))
  port.start()
}
