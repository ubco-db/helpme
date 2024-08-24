'use client'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { Role, TACheckinPair } from '@koh/common'
import { useCallback, useEffect, useRef, useState } from 'react'
import { API } from '@/app/api'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import { message, Spin } from 'antd'
import { FullCalendarEvent } from '@/app/typings/types'
import CenteredSpinner from '@/app/components/CenteredSpinner'

type TACheckInCheckOutTimesProps = {
  params: { cid: string }
}

export default function TACheckInCheckOutTimes({
  params,
}: TACheckInCheckOutTimesProps) {
  const courseId = Number(params.cid)

  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, courseId)
  const [events, setEvents] = useState<any>([])
  const calendarRef = useRef(null)
  const spinnerRef = useRef<HTMLDivElement | null>(null)
  const [tasWhoForgotToCheckOut, setTasWhoForgotToCheckOut] = useState<
    TACheckinPair[]
  >([])
  const [tasWhoAreBusy, setTasWhoAreBusy] = useState<TACheckinPair[]>([])

  const getEvent = useCallback(async () => {
    try {
      // just get data +/- 1 year from now
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - 1)
      const endDate = new Date()
      endDate.setFullYear(endDate.getFullYear() + 1)

      const result = await API.course.getTACheckinTimes(
        courseId,
        startDate.toISOString(),
        endDate.toISOString(),
      )

      setTasWhoForgotToCheckOut(result.taCheckinTimes.filter((e) => e.forced))
      setTasWhoAreBusy(result.taCheckinTimes.filter((e) => e.inProgress))

      const modifiedEvents = result.taCheckinTimes.map((event) =>
        parseEvent(event),
      )
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

  const parseEvent = (event: TACheckinPair) => {
    const startDate = new Date(event.checkinTime)
    const endDate = event.checkoutTime
      ? new Date(event.checkoutTime)
      : new Date()
    const returnEvent: FullCalendarEvent = {
      title: event.inProgress
        ? `TA currently in queue: ${event.name} - ${event.numHelped} helped`
        : event.forced
          ? `TA forgot to check out: ${event.name} - ${event.numHelped} helped`
          : `${event.name} - ${event.numHelped} helped`,
      start: startDate,
      backgroundColor: event.inProgress
        ? '#087837'
        : event.forced
          ? '#9e115a'
          : undefined,
      end: endDate,
      studentsHelped: event.numHelped,
    }
    return returnEvent
    // if (event.endDate) {
    //   returnEvent['endRecur'] = event.endDate
    //   returnEvent['daysOfWeek'] = event.daysOfWeek
    //   returnEvent['startTime'] = format(startDate, 'HH:mm')
    //   returnEvent['endTime'] = format(endDate, 'HH:mm')
    //   return returnEvent
    // } else {
    //   return returnEvent
    // }
  }
  if (role !== Role.PROFESSOR) {
    return (
      <CenteredSpinner tip="You have been cursed with the infinite spinner! Begone!" />
    )
  } else {
    return (
      <div>
        <h1>TA Check-In Check-Out Times</h1>
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
            slotMinTime="08:00:00"
            slotDuration="00:30:00"
            scrollTime="10:00:00"
            initialView={'timeGridWeek'}
            nowIndicator={true}
            initialEvents={events}
            allDaySlot={false}
            headerToolbar={{
              start: 'title',
              center: 'dayGridMonth timeGridWeek listWeek',
              end: 'today prev,next',
            }}
            loading={(loading) => {
              if (spinnerRef.current)
                spinnerRef.current.style.display = loading ? 'flex' : 'none'
            }}
            height="94vh"
            timeZone="local"
            eventClick={(clickInfo) => {
              message.info(
                `${clickInfo.event.title} helped ${clickInfo.event.extendedProps.studentsHelped} students in their office hours`,
              )
            }}
          />
        </div>
        {tasWhoAreBusy.length ? (
          <div>
            <h3>People currently holding office hours:</h3>
            {tasWhoAreBusy.map((ta) => (
              <p className="font-bold" key={ta.name}>
                {ta.name}
              </p>
            ))}
          </div>
        ) : null}
        {tasWhoForgotToCheckOut.length ? (
          <div>
            <h3 style={{ color: 'red' }}>
              The following course staff forgot to check out:
            </h3>
            {tasWhoForgotToCheckOut.map((ta) => (
              <p className="font-bold" key={ta.name}>
                {ta.name}
              </p>
            ))}
            <p className="mt-3">
              Please remind course staff to check out at the end of their
              session. This way students don&apos;t join a queue thinking that
              there is still an ongoing session when the course staff has
              already left
            </p>
          </div>
        ) : null}
      </div>
    )
  }
}
