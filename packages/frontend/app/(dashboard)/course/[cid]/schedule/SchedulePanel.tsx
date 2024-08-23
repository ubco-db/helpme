'use client'

import { ReactElement, useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import DayTimeColsView from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Form, Input, Modal, Spin, Switch, Tooltip, message } from 'antd'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import './fullcalendar.css'
import { API } from '@/app/api'
import { Role } from '@koh/common'
import { format } from 'date-fns'
import { useUserInfo } from '@/app/contexts/userContext'

type ScheduleProps = {
  courseId: number
  defaultView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
}

export default function SchedulePanel({
  courseId,
  defaultView = 'timeGridWeek',
}: ScheduleProps): ReactElement {
  const [form] = Form.useForm()
  const [events, setEvents] = useState<any>([])
  const [eventVisible, setEventVisible] = useState(false)
  const [info, setInfo] = useState(null)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, courseId)
  const calendarRef = useRef(null)
  const spinnerRef = useRef(null)

  useEffect(() => {
    if (courseId) {
      getEvent()
    }
  }, [courseId])

  const getEvent = async () => {
    const result = await API.calendar.getEvents(Number(courseId))
    const modifiedEvents = result.map((event) => parseEvent(event))
    setEvents(modifiedEvents)
  }

  const parseEvent = (event: any) => {
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

  const renderEventContent = (arg: any) => {
    const data = (calendarRef.current as any)?.getApi()?.getCurrentData()
    const viewSpec = data?.viewSpecs[arg.view.type].component
    if (viewSpec === DayTimeColsView) {
      return (
        <Tooltip title={`${arg.timeText}: ${arg.event.title}`}>
          <span>
            <strong>{arg.timeText}</strong> {arg.event.title}
          </span>
        </Tooltip>
      )
    }
  }

  const onOk = async (values: any) => {
    const calendarApi = info.view.calendar
    calendarApi.unselect() // clear date selection
    let e = null
    if (values.repeat) {
      const date = new Date(info.startStr)
      const selectedDay = String(date.getDay())
      e = {
        cid: courseId,
        title: values.eventName,
        start: info.startStr,
        end: info.endStr,
        daysOfWeek: [selectedDay],
      }
    } else {
      e = {
        cid: courseId,
        title: values.eventName,
        start: info.startStr,
        end: info.endStr,
      }
    }
    const event = await API.calendar.addCalendar(e)
    setEvents([...events, parseEvent(event)])
  }

  const onCancel = () => {
    setEventVisible(false)
  }

  const handleDateSelect = (selectInfo: any) => {
    setInfo(selectInfo)
    setEventVisible(true)
  }

  const handleEventClick = async (clickInfo: any) => {
    if (
      confirm(
        `Are you sure you want to delete the event '${clickInfo.event.title}'`,
      )
    ) {
      const result = await API.calendar.deleteEvent(clickInfo.event.id)
      if (result) {
        setEvents(
          events.filter((event: { id: any }) => event.id != clickInfo.event.id),
        )
      } else {
        message.error('Deletion failed')
      }
    }
  }

  const calendarComponent = (
    <div className="relative mb-5">
      <div
        ref={spinnerRef}
        className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[#f8f9fb99]"
      >
        <Spin />
      </div>
      <div className="mb-5">
        <FullCalendar
          selectable={role !== Role.STUDENT}
          editable={role !== Role.STUDENT}
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            listPlugin,
            interactionPlugin,
          ]}
          events={events}
          scrollTime={role === Role.STUDENT ? '10:00:00' : '13:00:00'}
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
          height={role === Role.STUDENT ? '70vh' : '100vh'}
          timeZone="local"
          eventClick={role !== Role.STUDENT ? handleEventClick : undefined}
          select={role !== Role.STUDENT ? handleDateSelect : undefined}
        />
      </div>
    </div>
  )

  if (role === Role.STUDENT) {
    return calendarComponent
  } else {
    return (
      <>
        {calendarComponent}
        <Modal
          visible={eventVisible}
          onOk={async () => {
            await form.validateFields().then((value) => onOk(value))
            onCancel()
          }}
          onCancel={onCancel}
        >
          <Form
            form={form}
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            className="max-w-[600px]"
          >
            <Form.Item
              label="Event Name"
              name="eventName"
              rules={[{ required: true, message: 'Please input event name!' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="Repeat Weekly"
              name="repeat"
              valuePropName="checked"
            >
              <Switch data-cy="repeat-toggle" />
            </Form.Item>
          </Form>
        </Modal>
      </>
    )
  }
}
