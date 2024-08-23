'use client'

import { ReactElement, useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import { Spin, Tooltip } from 'antd'
import './fullcalendar.css'
import { API } from '@/app/api'
import EventContentArg from '@fullcalendar/react'
import format from '@fullcalendar/react'

type ScheduleProps = {
  courseId: number
  defaultView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
}

export default function StudentSchedulePanel({
  courseId,
  defaultView = 'timeGridWeek',
}: ScheduleProps): ReactElement {
  const [isClientSide, setIsClientSide] = useState(false)
  const [events, setEvents] = useState([])
  const calendarRef = useRef(null)
  const spinnerRef = useRef(null)

  useEffect(() => {
    setIsClientSide(true)
  }, [])

  useEffect(() => {
    if (courseId) {
      getEvent()
    }
  }, [courseId])

  const getEvent = async () => {
    try {
      const result = await API.calendar.getEvents(Number(courseId))
      const modifiedEvents = result.map((event) => parseEvent(event))
      setEvents(modifiedEvents)
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setEvents([])
      } else {
        console.error('An error occurred while fetching events:', error)
      }
    }
  }

  const parseEvent = (event) => {
    if (event.daysOfWeek) {
      const startDate = new Date(event.start)
      const endDate = new Date(event.end)
      return {
        id: event.id,
        title: event.title,
        daysOfWeek: event.daysOfWeek,
        startTime: format(startDate, 'HH:mm'),
        endTime: format(endDate, 'HH:mm'),
      }
    } else {
      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
      }
    }
  }

  const renderEventContent = (arg: EventContentArg) => {
    const viewSpec = arg.view.type
    if (viewSpec === 'timeGridWeek' || viewSpec === 'timeGridDay') {
      return (
        <Tooltip title={`${arg.timeText}: ${arg.event.title}`}>
          <span>
            <strong>{arg.timeText}</strong> {arg.event.title}
          </span>
        </Tooltip>
      )
    }
  }

  return (
    <div>
      <div
        ref={spinnerRef}
        className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[#f8f9fb99]"
      >
        <Spin />
      </div>
      {isClientSide && !isNaN(courseId) && (
        <div className="mb-5">
          <FullCalendar
            selectable={false}
            editable={false}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            events={events}
            scrollTime="10:00:00"
            initialView={defaultView}
            initialEvents={events}
            eventContent={renderEventContent}
            headerToolbar={{
              start: 'title',
              center: 'dayGridMonth timeGridWeek timeGridDay listWeek',
              end: 'today prev,next',
            }}
            loading={(loading) => {
              if (spinnerRef.current)
                spinnerRef.current.style.display = loading ? 'flex' : 'none'
            }}
            height="70vh"
            timeZone="local"
          />
        </div>
      )}
    </div>
  )
}
