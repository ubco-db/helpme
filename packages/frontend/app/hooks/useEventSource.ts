import { useEffect, useState } from 'react'
import ReconnectingEventSource from 'reconnecting-eventsource'

interface ListenerAndCount {
  listener: (d: any) => void
  count: number
}

interface SourceAndCount {
  eventSource: EventSource
  listeners: Record<string, ListenerAndCount>
  isLiveSetters: Set<(live: boolean) => void>
}
const EVENTSOURCES: Record<string, SourceAndCount> = {}

/**
 * Listen to eventsource at given url calling the given onmessage when messages are received.
 * onmessage is overwritten if listenerKey is the same.
 * Returns whether the event source is connected
 *
 * Adam: I believe this was implemented for if the browser is listening to multiple different EventSources (i.e. SSE endpoints).
 * Multiple browser tabs with the queue open, for example - I want to guess it re-uses the same EventSource somehow in this case, but I'm not sure.
 * I think another example is you could have an Alerts EventSource and a Queue EventSource,
 * and I think this would just be a unified area for them all so they get closed on exit?
 *
 *
 * @param url URL to subscribe event source to
 * @param listenerKey key of the listener. eg: "queue" or "question"
 * @param onmessage callback when messages are received
 */
export const useEventSource = (
  url: string | null,
  listenerKey: string,
  onmessage: (d: any) => void,
): boolean => {
  const [isLive, setIsLive] = useState<boolean>(false)
  useEffect(() => {
    if (url) {
      let source: SourceAndCount
      if (url in EVENTSOURCES) {
        source = EVENTSOURCES[url]
      } else {
        source = {
          eventSource: new ReconnectingEventSource(url),
          listeners: {},
          isLiveSetters: new Set(),
        }
        EVENTSOURCES[url] = source
        source.eventSource.onmessage = function logEvents(event) {
          const values = Object.values(source.listeners)
          const eventData = JSON.parse(event.data)
          values.forEach((lac) => lac.listener(eventData))
        }
        source.eventSource.onopen = () =>
          source.isLiveSetters.forEach((set) => set(true))
        source.eventSource.onerror = () =>
          source.isLiveSetters.forEach((set) => set(false))
      }

      setIsLive(source.eventSource.readyState === EventSource.OPEN)
      source.isLiveSetters.add(setIsLive)

      let listener = source.listeners[listenerKey]

      if (source.listeners[listenerKey]) {
        listener.count++
      } else {
        listener = { listener: onmessage, count: 1 }
        source.listeners[listenerKey] = listener
      }

      return () => {
        // Close event source if no one is listening
        listener.count--
        source.isLiveSetters.delete(setIsLive)
        if (listener.count === 0) {
          delete source.listeners[listenerKey]
          if (Object.values(source.listeners).length === 0) {
            source.eventSource.close()
            delete EVENTSOURCES[url]
          }
        }
      }
    }
  }, [url, onmessage, listenerKey])

  return isLive
}
