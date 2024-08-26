import { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import { message, Spin } from 'antd'
import { API } from '@/app/api'
import { format } from 'date-fns'
import { Calendar } from '@koh/common'
import { Event } from '@/app/typings/types'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'

type ScheduleProps = {
  courseId: number
  defaultView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
}

/**
 * Note that for mobile, the defaultView gets ovverriden to 'timeGridDay'
 */
const StudentSchedulePanel: React.FC<ScheduleProps> = ({
  courseId,
  defaultView = 'timeGridWeek',
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [events, setEvents] = useState<any>([])
  const calendarRef = useRef<FullCalendar>(null)
  const spinnerRef = useRef<HTMLDivElement | null>(null)

  const getEvent = useCallback(async () => {
    try {
      const result = await API.calendar.getEvents(Number(courseId))
      const modifiedEvents = result.map((event) => parseEvent(event))
      setEvents(modifiedEvents)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('An error occurred while fetching events:' + errorMessage)
    }
  }, [courseId, setEvents])

  useEffect(() => {
    if (courseId) {
      getEvent()
    }
  }, [courseId, getEvent])

  const parseEvent = (event: Calendar) => {
    const startTime = new Date(event.start)
    const endTime = new Date(event.end)
    const returnEvent: Event = {
      id: event.id,
      title: event.title,
      start: startTime,
      end: endTime,
      startDate: event.startDate || null,
      locationType: event.locationType,
      locationInPerson: event.locationInPerson || null,
      locationOnline: event.locationOnline || null,
    }
    if (event.endDate) {
      returnEvent['endRecur'] = event.endDate
      returnEvent['daysOfWeek'] = event.daysOfWeek
      returnEvent['startTime'] = format(startTime, 'HH:mm')
      returnEvent['endTime'] = format(endTime, 'HH:mm')
      return returnEvent
    } else {
      return returnEvent
    }
  }

  // sets default view to timeGridDay on mobile
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.changeView(isMobile ? 'timeGridDay' : defaultView)
    }
  }, [isMobile, defaultView])

  return (
    <div>
      <div
        ref={spinnerRef}
        className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[#f8f9fb99]"
      >
        <Spin />
      </div>
      <div className="mb-5">
        <FullCalendar
          selectable={false}
          editable={false}
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          events={events}
          scrollTime="10:00:00"
          nowIndicator={true}
          allDaySlot={false}
          slotMinTime="08:00:00"
          initialView={defaultView} // doing isMobile ? 'timeGridDay' : defaultView doesn't work since isMobile is initially false
          initialEvents={events}
          headerToolbar={{
            start: 'title',
            center: `dayGridMonth timeGridWeek ${isMobile ? 'timeGridDay ' : ''}listWeek`, // only show timeGridDay on mobile since it's kinda unnecessary on desktop
            end: 'today prev,next',
          }}
          loading={(loading) => {
            if (spinnerRef.current)
              spinnerRef.current.style.display = loading ? 'flex' : 'none'
          }}
          height="57em"
          timeZone="local"
        />
      </div>
    </div>
  )
}

export default StudentSchedulePanel
