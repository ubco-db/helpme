'use client'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { Role, TACheckinPair } from '@koh/common'
import { useCallback, useEffect, useRef, useState, use } from 'react'
import { API } from '@/app/api'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import { message, Spin, Tooltip } from 'antd'
import { FullCalendarEvent, TAStatus } from '@/app/typings/types'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { format } from 'date-fns'

type TACheckInCheckOutTimesProps = {
  params: Promise<{ cid: string }>
}

export default function TACheckInCheckOutTimes(
  props: TACheckInCheckOutTimesProps,
) {
  const params = use(props.params)
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

      const awayEvents =
        result.taAwayTimes?.map((away) => ({
          title: `${away.name} (Away)`,
          start: new Date(away.awayStartTime),
          end: away.awayEndTime ? new Date(away.awayEndTime) : new Date(),
          backgroundColor: away.inProgress ? '#d97706' : '#f59e0b',
          studentsHelped: 0,
          TAStatus: TAStatus.Away,
        })) ?? [];
      setEvents([...modifiedEvents, ...awayEvents]);

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
      title: event.name,
      start: startDate,
      backgroundColor: event.inProgress
        ? '#087837'
        : event.forced
          ? '#9e115a'
          : undefined,
      end: endDate,
      studentsHelped: event.numHelped,
      TAStatus: event.inProgress
        ? TAStatus.InQueue
        : event.forced
          ? TAStatus.ForgotToCheckOut
          : TAStatus.CheckedOut,
    }
    return returnEvent
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
        <div className="mb-5 text-sm">
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
            height="54em"
            timeZone="local"
            eventContent={(info) => {
              const event = info.event
              const extendedProps = info.event
                .extendedProps as FullCalendarEvent
              const TAName = event.title
              const formattedStart = event.start
                ? format(event.start, 'h:mm')
                : ''
              const formattedEnd = event.end ? format(event.end, 'h:mm') : ''
              const formattedStartWithAmPm = event.start
                ? format(event.start, 'h:mmaaa')
                : ''
              const formattedEndWithAmPm = event.end
                ? format(event.end, 'h:mmaaa')
                : ''

              return (
                <Tooltip
                  title={
                    <div>
                      <p className="text-base">{TAName}</p>
                      <p>
                        {formattedStartWithAmPm} - {formattedEndWithAmPm}
                      </p>
                      <p>
                        {extendedProps.studentsHelped} helped
                        {extendedProps.TAStatus === TAStatus.InQueue
                          ? ' so far'
                          : ''}
                      </p>
                      {extendedProps.TAStatus !== TAStatus.CheckedOut && (
                        <p>{extendedProps.TAStatus}</p>
                      )}
                    </div>
                  }
                >
                  <div className="flex h-full max-h-full flex-col gap-y-0.5 overflow-hidden">
                    <p className="font-weight-lighter text-xs">
                      {formattedStart} - {formattedEnd}
                    </p>
                    <p>{TAName}</p>
                    <p className="text-xs">
                      {extendedProps.studentsHelped} helped
                      {extendedProps.TAStatus === TAStatus.InQueue
                        ? ' so far'
                        : ''}
                    </p>
                  </div>
                </Tooltip>
              )
            }}
          />
        </div>
        {tasWhoAreBusy.length ? (
          <div>
            <h3>Staff currently in queues:</h3>
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
              Please consider creating some events on the Schedule page and
              assigning staff to them so that they will automatically be checked
              out at the end of their session. This way students don&apos;t join
              a queue thinking that there is still an ongoing session when the
              course staff has already left
            </p>
          </div>
        ) : null}
      </div>
    )
  }
}
