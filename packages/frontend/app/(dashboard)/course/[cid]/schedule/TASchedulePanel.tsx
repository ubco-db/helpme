'use client'
import { ReactElement, useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Spin } from 'antd'
import './fullcalendar.css'
import { API } from '@koh/api-client'
import { format } from 'date-fns'
import EditEventModal from './EditEventModal'
import CreateEventModal from './CreateEventModal'

type ScheduleProps = {
  courseId: number
  defaultView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
}

export default function TAFacultySchedulePanel({
  courseId,
  defaultView = 'timeGridWeek',
}: ScheduleProps): ReactElement {
  const calendarRef = useRef(null)
  const spinnerRef = useRef(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [createEvent, setCreateEvent] = useState(null)
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (courseId) {
      getEvent()
    }
  }, [courseId, editModalVisible, createModalVisible])

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
    const startDate = new Date(event.start)
    const endDate = new Date(event.end)
    const returnEvent: {
      id: any
      title: any
      start: Date
      end: Date
      locationType: any
      locationInPerson: any
      locationOnline: any
      endRecur?: any
      daysOfWeek?: any
      startTime?: any
      endTime?: any
    } = {
      id: event.id,
      title: event.title,
      start: startDate,
      end: endDate,
      locationType: event.locationType,
      locationInPerson: event.locationInPerson,
      locationOnline: event.locationOnline,
    }
    if (event.endDate) {
      returnEvent['endRecur'] = event.endDate
      returnEvent['daysOfWeek'] = event.daysOfWeek
      returnEvent['startTime'] = format(startDate, 'HH:mm')
      returnEvent['endTime'] = format(endDate, 'HH:mm')
      return returnEvent
    } else {
      return returnEvent
    }
  }

  const handleEditClick = (clickInfo) => {
    const selectedEvent = events.find(
      (event) => Number(event.id) === Number(clickInfo.event.id),
    )
    setSelectedEvent(selectedEvent)
    setEditModalVisible(true)
  }

  return (
    <div className="mb-5">
      <div
        ref={spinnerRef}
        className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[#f8f9fb99]"
      >
        <Spin />
      </div>
      {!isNaN(courseId) && (
        <div className="mb-5">
          <FullCalendar
            selectable={true}
            editable={true}
            ref={calendarRef}
            plugins={[
              timeGridPlugin,
              dayGridPlugin,
              listPlugin,
              interactionPlugin,
            ]}
            eventClick={handleEditClick}
            select={(select) => {
              setCreateEvent({
                start: select.start,
                end: select.end,
              })
              setCreateModalVisible(true)
            }}
            events={events}
            scrollTime="13:00:00"
            initialView={defaultView}
            initialEvents={events}
            headerToolbar={{
              start: 'title',
              center: 'dayGridMonth timeGridWeek timeGridDay listWeek',
              end: 'today prev,next',
            }}
            loading={(loading) => {
              if (spinnerRef.current)
                spinnerRef.current.style.display = loading ? 'flex' : 'none'
            }}
            height="100vh"
          />
          <EditEventModal
            visible={editModalVisible}
            onClose={() => setEditModalVisible(false)}
            event={selectedEvent}
            courseId={courseId}
          />
          <CreateEventModal
            visible={createModalVisible}
            onClose={() => setCreateModalVisible(false)}
            event={createEvent}
            courseId={courseId}
          />
        </div>
      )}
    </div>
  )
}
