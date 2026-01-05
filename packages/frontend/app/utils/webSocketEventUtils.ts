import { ClassType } from 'class-transformer/ClassTransformer'
import { plainToInstance } from 'class-transformer'

export function filterWebSocketEvent<T>(
  event: MessageEvent<{ type: string; data: T }>,
  desiredEvent: string,
  responseClass?: ClassType<T>,
): { match: boolean; data?: T } {
  const { type, data } = event.data
  if (type === desiredEvent) {
    return {
      match: true,
      data: responseClass ? plainToInstance(responseClass, data) : data,
    }
  }
  return { match: false }
}
