import {
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Checkbox,
  Radio,
  Tooltip,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import moment from 'moment'
import { API } from '@koh/api-client'
import { on } from 'events'
import { calendarEventLocationType } from '@koh/common'
import { set } from 'lodash'

const dayToIntMapping = {
  Sunday: '0',
  Monday: '1',
  Tuesday: '2',
  Wednesday: '3',
  Thursday: '4',
  Friday: '5',
  Saturday: '6',
}
const locationTypeMapping = {
  'in-person': 0,
  online: 1,
  hybrid: 2,
}

type EditEventModalProps = {
  visible: boolean
  onClose: () => void
  event: any
  courseId: number
}

const EditEventModal = ({
  visible,
  onClose,
  event,
  courseId,
}: EditEventModalProps) => {
  const [form] = Form.useForm()
  const [isRepeating, setIsRepeating] = useState(false)
  const [locationType, setLocationType] = useState(
    locationTypeMapping[event?.locationType],
  )
  const [selectedDays, setSelectedDays] = useState(null)

  useEffect(() => {
    // Set initial form values with the event data
    form.setFieldsValue({
      title: event?.title,
      locationInPerson: event?.locationInPerson,
      locationOnline: event?.locationOnline,
      endDate: event?.endRecur ? moment(event.endRecur) : null,
      locationType: locationTypeMapping[event?.locationType],
    })
    setIsRepeating(!!event?.endRecur)
    if (event && event.daysOfWeek) {
      setSelectedDays(event.daysOfWeek.map((dayInt) => intToDayMapping[dayInt]))
    }
  }, [event, form])
  const intToDayMapping = Object.fromEntries(
    Object.entries(dayToIntMapping).map(([key, value]) => [value, key]),
  )

  const handleDaysChange = (checkedValues) => {
    if (!checkedValues.includes(moment(event?.start).format('dddd'))) {
      checkedValues.push(moment(event?.start).format('dddd'))
    }
    setSelectedDays(checkedValues)
  }
  const handleOk = async () => {
    try {
      const formData = await form.validateFields()
      const eventObject = {
        ...formData,
        cid: courseId,
        start: moment(event.start).toISOString(),
        end: moment(event.end).toISOString(),
      }
      switch (locationType) {
        case 0: // In Person
          eventObject.locationType = calendarEventLocationType.inPerson
          eventObject.locationInPerson = formData.locationInPerson
          break
        case 1: // Online
          eventObject.locationType = calendarEventLocationType.online
          eventObject.locationOnline = formData.locationOnline
          break
        case 2: // Hybrid
          eventObject.locationType = calendarEventLocationType.hybrid
          eventObject.locationInPerson = formData.locationInPerson
          eventObject.locationOnline = formData.locationOnline
          break
        default:
          message.error('Invalid location type')
          return // Prevents the function from continuing
      }

      // Logic for repeating events
      if (isRepeating) {
        if (formData.endDate && selectedDays) {
          eventObject.daysOfWeek = selectedDays.map(
            (day) => dayToIntMapping[day],
          )
          eventObject.startDate = moment().startOf('day').format('YYYY-MM-DD')
          eventObject.endDate = moment(formData.endDate).format('YYYY-MM-DD')
        } else {
          message.error('Please select all fields for repeating events')
          return // Prevents the function from continuing
        }
      }
      updateEvent(eventObject)
    } catch (validationError) {
      message.error('Event validation failed')
    }
  }

  const updateEvent = async (updatedEvent) => {
    try {
      const response = await API.calendar.patchEvent(event.id, updatedEvent)
      if (response) {
        console.log('Event updated successfully', response)
      } else {
        console.error('Failed to update event')
      }
    } catch (err) {
      console.error('Error updating the event:', err.message || err)
    }
    onClose()
  }
  return (
    <Modal
      title="Edit Event"
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      closable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true, message: 'Please input the title!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="Start Time" name="startTime">
          <TimePicker
            defaultValue={
              event ? moment(event.startTime, 'HH:mm:ss') : moment()
            }
            format="HH:mm"
          />
        </Form.Item>

        <Form.Item label="End Time" name="endTime">
          <TimePicker
            defaultValue={event ? moment(event.endTime, 'HH:mm:ss') : moment()}
            format="HH:mm"
          />
        </Form.Item>

        <Form.Item>
          <Checkbox
            checked={isRepeating}
            onChange={(e) => setIsRepeating(e.target.checked)}
          >
            Repeat Event
          </Checkbox>
        </Form.Item>

        {isRepeating && (
          <>
            <Form.Item label="End Date" name="endDate">
              <DatePicker />
            </Form.Item>
            <Form.Item label="Repeat on">
              <Checkbox.Group
                name="repeatDays"
                value={selectedDays}
                onChange={handleDaysChange}
              >
                {Object.keys(dayToIntMapping).map((day) => (
                  <Checkbox key={day} value={day}>
                    {day}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          </>
        )}
        <Form.Item
          label="Location Type"
          name="locationType"
          rules={[
            { required: true, message: 'Please select the location type!' },
          ]}
        >
          <Radio.Group
            onChange={(e) => setLocationType(e.target.value)}
            value={locationType}
          >
            <Radio value={0}>In-Person</Radio>
            <Radio value={1}>Online</Radio>
            <Radio value={2}>Hybrid</Radio>
          </Radio.Group>
        </Form.Item>

        {locationType === 0 && (
          <Form.Item
            label="Location"
            name="locationInPerson"
            rules={[{ required: true, message: 'Please input the location!' }]}
          >
            <Input />
          </Form.Item>
        )}

        {locationType === 1 && (
          <Form.Item
            label="Zoom Link"
            name="locationOnline"
            rules={[
              { required: true, message: 'Please input the meeting link!' },
            ]}
          >
            <Input />
          </Form.Item>
        )}

        {locationType === 2 && (
          <>
            <Form.Item
              label="Location"
              name="locationInPerson"
              rules={[
                { required: true, message: 'Please input the location!' },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Zoom Link"
              name="locationOnline"
              rules={[
                { required: true, message: 'Please input the meeting link!' },
              ]}
            >
              <Input />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}

export default EditEventModal
