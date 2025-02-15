import { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Event } from '@/app/typings/types'
import { message, Spin } from 'antd'
import { API } from '@/app/api'
import { format } from 'date-fns'
import EditEventModal from './EditEventModal'
import CreateEventModal from './CreateEventModal'
import { Calendar } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import tinycolor from 'tinycolor2'
import EventTooltip from './EventTooltip'

type ScheduleProps = {
  courseId: number
  defaultView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
  condensed?: boolean
}

/**
 * Note that for mobile, the defaultView gets ovverriden to 'timeGridDay'
 */
const TAFacultySchedulePanel: React.FC<ScheduleProps> = ({
  courseId,
  defaultView = 'timeGridWeek',
  condensed = false,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const calendarRef = useRef<FullCalendar>(null)
  const spinnerRef = useRef<HTMLDivElement>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [createEvent, setCreateEvent] = useState<{ start: Date; end: Date }>()
  // see https://fullcalendar.io/docs/event-source-object#options for typing of events
  const [events, setEvents] = useState<any>([])

  const getEvent = useCallback(async () => {
    try {
      const result = await API.calendar.getEvents(courseId)
      const modifiedEvents = result.map((event) => parseEvent(event))
      setEvents(modifiedEvents)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('An error occurred while fetching events: ' + errorMessage)
    }
  }, [courseId, setEvents])

  useEffect(() => {
    if (courseId) {
      getEvent()
    }
  }, [courseId, editModalVisible, createModalVisible, getEvent])

  const parseEvent = (event: Calendar) => {
    const startTime = new Date(event.start)
    const endTime = new Date(event.end)
    const textColor = event.color
      ? tinycolor(event.color).isDark()
        ? '#fff'
        : '#000'
      : '#fff'
    const borderColor = event.color
      ? tinycolor(event.color).darken(10).toString()
      : '#3788d8'
    const returnEvent: Event = {
      id: event.id,
      title: event.title,
      start: startTime,
      end: endTime,
      startDate: event.startDate || null,
      locationType: event.locationType,
      locationInPerson: event.locationInPerson || null,
      locationOnline: event.locationOnline || null,
      backgroundColor: event.color ?? '#3788d8',
      borderColor: borderColor,
      textColor: textColor,
      staffIds: event.staffIds ?? [],
    }
    if (event.endDate) {
      returnEvent['startRecur'] = event.startDate
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
            eventResizableFromStart={false} // prevents you from being able to click and drag to change the start time of the event (that would require extra logic to implement properly)
            eventDurationEditable={false} // prevents you from being able to click and drag to change the duration (end time) of the event (that would require extra logic to implement properly)
            events={events}
            scrollTime="10:00:00"
            nowIndicator={true}
            allDaySlot={!condensed}
            slotMinTime="08:00:00"
            initialView={defaultView} // doing isMobile ? 'timeGridDay' : defaultView doesn't work since isMobile is initially false
            initialEvents={events}
            headerToolbar={{
              start: 'title',
              center: `dayGridMonth timeGridWeek ${isMobile ? 'timeGridDay ' : ''}listWeek`, // only show timeGridDay on mobile since it's kinda unnecessary on desktop
              end: 'addEventButton today prev,next',
            }}
            customButtons={{
              addEventButton: {
                text: 'Add Event',
                click: () => {
                  const now = new Date()
                  // Round to nearest 5 minutes
                  now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0)
                  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
                  setCreateEvent({
                    start: now,
                    end: oneHourLater,
                  })
                  setCreateModalVisible(true)
                },
              },
            }}
            loading={(loading) => {
              if (spinnerRef.current)
                spinnerRef.current.style.display = loading ? 'flex' : 'none'
            }}
            height={condensed ? '56.5em' : '60em'}
            eventContent={(info) => <EventTooltip info={info} />} // custom event tooltip
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

export default TAFacultySchedulePanel
