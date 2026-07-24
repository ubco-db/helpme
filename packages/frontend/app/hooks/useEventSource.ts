import { isProd } from '@koh/common'
import { useEffect, useEffectEvent, useState } from 'react'
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
/* This "EVENTSOURCES" is BS nonsense. 
The person who implemented this thought this would work like a global state variable. 
It sorta does, but it seems that's only the case if they're all on the same page 
(like it's setting a regular global javascript variable).
Regardless, this is hard to understand or follow. They should've used a context instead.

But I figured out the reason why this exists:
Normally, you wouldn't want to put a data fetcher call into a hook unless you're certain the hook
is only going to get called once (since if it gets called in multiple components on the same page,
you would get multiple API calls and duplicate state etc.).
SWR has some features to remedy this (which presumably didn't exist in react like it does now): 
- SWR manages its own global state
- SWR will deduplicate multiple components making the same request
- SWR will also do the whole polling/revalidating things to give the impression of getting live-ish data.

This allows people to make data fetcher hooks that live in many components since SWR will solve
it all for them. This is probably how useQueue and useQuestions was first implemented.

But the person who went and implemented the "live" aspect of the queue (with EventSource/SSE)
probably made a simple useEventSource hook and realized that if each useQueue or useQuestions 
is creating a new EventSource, it ends up creating a lot of excess connections all subscribed
to the same endpoints.

To get around this, they created this ""global"" state variable (EVENTSOURCES) that keeps track of
each EventSource and will re-assign subsequent useEventSource calls to re-use existing connections.  

This feels fragile, hard to understand (there were like 0 comments here before, and this feels like
a HUGE anti-pattern for react), and probably not very performant.

TODO: Make a context for queue and questions and whatever else that holds the queue or question state and is setup with a single EventSource.
I also realized that this approach of having multiple components all calling the same hook 
can result in a TON of extra unnecessary processing 
(like how useQuestions does the data sorting/filtering - that's duplicated work for every useQuestions), so
having a single context hold all the data should be a lot better.

tl;dr: EVENTSOURCES is used for deduplication. But it was implemented in a sus way.
*/
const EVENTSOURCES: Record<string, SourceAndCount> = {}

/**
 * Listen to eventsource at given url calling the given onMessage when messages are received.
 * onMessage is overwritten if listenerKey is the same.
 * Adam: I figured out why onMessage gets overwritten for duplicate listenerKeys:
 * It's so that multiple useQueue or useQuestion hooks don't all run the exact same callback
 * function to update SWR's state. It's another deduplication thing.
 *
 * Returns whether the event source is connected
 *
 *
 * @param url URL to subscribe event source to
 * @param listenerKey key of the listener. eg: "queue" or "question"
 * @param onMessage callback when messages are received
 */
export const useEventSource = (
  url: string | null,
  listenerKey: string,
  onMessage: (d: any) => void,
): boolean => {
  /* Oh hey I finally found a spot where I really needed useEffectEvent (I had to update the next.js version for it too lol).
  
      In order to explain why I needed it here or what it does, first understand how useEventSource works: It uses a 
      useEffect to create a new EventSource (for subscribing to Server Sent Events) with the given url and to trigger
      the given onMessage when it receives new data from the server.
       
      Next, understand that useEffect's primary purpose is to connect with external systems, 
      think like to add a JS event listener or subscribing to a connection  
      (we also use it for data fetching in a bunch of places but we should be using useSWRImmutable or something instead). 
      Creating an EventSource with a useEffect is a perfect use case for it.
  
      Now, when you use a function (like onMessage) or use state data inside a useEffect, you're supposed to also add
      those variables to the useEffect's dependency array. This is to signify to the useEffect that when these variables change,
      it should re-run with the new values. For example, whenever the `url` in useEventSource changes, it re-runs the useEffect
      to create a new EventSource connection with the new url and cleans up the old one.
  
      Whenever onMessage changes, the useEffect will also re-run so that it calls an updated onMessage. This is important
      since in the example for alerts (where we append new alert data to its existing state), its onMessage function would need to change
      otherwise it would attempt to append the new alert data to an outdated array of alerts state.
      This would mean that if we tried omitting `onMessage` from the dependency array, any new alert data will do this:
      1: Current `alerts` state: [alert1]. New alert inbound: `alert2`. Appending to `alerts` state. New state: [alert1, alert2] 
      2: Current `alerts` state: [alert1]. New alert inbound: `alert3`. Appending to `alerts` state. New state: [alert1, alert3]
      3: Current `alerts` state: [alert1]. New alert inbound: `alert4`. Appending to `alerts` state. New state: [alert1, alert4]
      (notice that because the `onMessage` is outdated, its current view of the `alerts` state is outdated and thus it keeps replacing instead of appending the new alerts)
  
      However, keeping onMessage inside the dependency array introduces another problem: 
      **the useEffect will re-run every time onMessage changes, *recreating a new EventSource* connection each time**.
  
      In the example for alerts, since its onMessage appends, its onMessage will update every time there's new data, *thus recreating the connection each time*.
      Recreating connections like this is really bad! Like for performance etc. 
      It's also hard to tell unless you check the Network tab in browser. I didn't even notice this was an issue until I noticed it took multiple
      clicks to close an alert Modal.
  
      The solution: useEffectEvent! Basically, it's a function that completely recreates itself every time its ran.
      This allows you to remove it from dependency arrays for useEffects, since it will always have updated state no matter what.
      You can basically think of useEffectEvent as a handler function that you can put inside useEffect.
      We could probably use it in a bunch of other places too (though 95% of our current useEffects are probably unnecessary or data fetchers, so that should be changed first).
  
      One question you might have: "If we're recreating the function every time it gets ran, wouldn't that mean
      it gets recreated every time the frontend receives new data and onMessage fires? Isn't that bad for performance?"
      and to answer that: in the alerts case, we would need to recreate the function each time anyway since we append data.
  
      ---
  
      Now the reason I'm only finding out about this *now*: For all of the current places we use useEventSource, we create really small 
      onMessage functions that manage to bypass needing to useEffectEvent by utilizing SWR's global `mutate()` function. But all of these places
      also just replace current data with the incoming data (which is worse performance for backend and frontend but simpler).
      It could probably be worthwhile changing someday. 
      TODO: maybe do this someday
  
    */
  const onMessageEvent = useEffectEvent(onMessage)

  const [isLive, setIsLive] = useState<boolean>(false)
  useEffect(() => {
    console.log('current EventSOurces', EVENTSOURCES)
    if (url) {
      let source: SourceAndCount
      if (url in EVENTSOURCES) {
        source = EVENTSOURCES[url]
      } else {
        console.log(
          'establishing new ReconnectingEventSource',
          url,
          listenerKey,
        )
        source = {
          eventSource: new ReconnectingEventSource(url, {
            max_retry_time: isProd()
              ? 15 * 1000 // 15s
              : 60 * 5 * 1000, // 5min
          }),
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
        console.log('new listener for', url, 'total listeners:', listener.count)
      } else {
        listener = { listener: onMessageEvent, count: 1 }
        source.listeners[listenerKey] = listener
      }

      return () => {
        // Close event source if no one is listening
        console.log('Closing  event source for', url)
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
  }, [url, listenerKey])

  return isLive
}
