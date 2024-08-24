import { ReactElement, useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Event } from '@/app/typings/types'
import { Spin } from 'antd'
import { API } from '@/app/api'
import { format } from 'date-fns'
import EditEventModal from './EditEventModal'
import CreateEventModal from './CreateEventModal'
import { Calendar } from '@koh/common'

type ScheduleProps = {
  courseId: number
  defaultView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
}

export default function TAFacultySchedulePanel({
  courseId,
  defaultView = 'timeGridWeek',
}: ScheduleProps): ReactElement {
  const calendarRef = useRef(null)
  const spinnerRef = useRef<HTMLDivElement>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [createEvent, setCreateEvent] = useState<{ start: Date; end: Date }>()
  // see https://fullcalendar.io/docs/event-source-object#options for typing of events
  const [events, setEvents] = useState<any>([])

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
      console.error('An error occurred while fetching events:', error)
    }
  }

  const parseEvent = (event: Calendar) => {
    const startDate = new Date(event.start)
    const endDate = new Date(event.end)
    const returnEvent: Event = {
      id: event.id,
      title: event.title,
      start: startDate,
      end: endDate,
      locationType: event.locationType,
      locationInPerson: event.locationInPerson || null,
      locationOnline: event.locationOnline || null,
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

  const handleEditClick = (clickInfo: any) => {
    const selectedEvent = events.find(
      (event: any) => Number(event.id) === Number(clickInfo.event.id),
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
