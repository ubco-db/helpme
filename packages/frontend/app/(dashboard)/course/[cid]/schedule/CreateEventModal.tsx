import {
  Modal,
  Form,
  Input,
  DatePicker,
  Checkbox,
  Radio,
  Tooltip,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import moment from 'moment'
import { API } from '@koh/api-client'
import { calendarEventLocationType } from '@koh/common'

const dayToIntMapping = {
  Sunday: '0',
  Monday: '1',
  Tuesday: '2',
  Wednesday: '3',
  Thursday: '4',
  Friday: '5',
  Saturday: '6',
}

type CreateEventModalProps = {
  visible: boolean
  onClose: () => void
  courseId: number
  event: any
}

const CreateEventModal = ({
  event,
  visible,
  onClose,
  courseId,
}: CreateEventModalProps) => {
  const [form] = Form.useForm()
  const [isRepeating, setIsRepeating] = useState(false)
  const [locationType, setLocationType] = useState(0)
  const [selectedDays, setSelectedDays] = useState(null)
  useEffect(() => {
    //default to the day of the event(create event object)
    setSelectedDays([moment(event?.start).format('dddd')])
  }, [event])
  const handleDaysChange = (checkedValues) => {
    if (!checkedValues.includes(moment(event?.start).format('dddd'))) {
      checkedValues.push(moment(event?.start).format('dddd'))
    }
    setSelectedDays(checkedValues)
  }
  const handleOk = async () => {
    try {
      const formData = await form.validateFields()
      console.log(formData)
      const eventObject = {
        ...formData,
        cid: courseId,
        title: formData.title,
        end: moment(event.end).toISOString(),
        start: moment(event.start).toISOString(),
      }
      // Set the location type based on the value of locationType
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
      createEvent(eventObject)
    } catch (validationError) {
      message.error('Event validation failed')
    }
  }

  const createEvent = async (newEvent) => {
    try {
      const response = await API.calendar.addCalendar(newEvent)
      if (response) {
        message.success('Event created successfully')
        form.resetFields()
      } else {
        message.error('Failed to create event')
      }
    } catch (err) {
      console.error('Error creating the event:', err.message || err)
    }
    onClose()
  }

  return (
    <Modal open={visible} onOk={handleOk} onCancel={onClose} closable={false}>
      <Form form={form}>
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true, message: 'Please input the title!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="Start Time">
          <Tooltip title="To change the time, exit this modal and reselect by dragging over a new area.">
            <span>{moment(event?.start).format('HH:mm YYYY-MM-DD')}</span>
          </Tooltip>
        </Form.Item>
        <Form.Item label="End Time">
          <Tooltip title="To change the time, exit this modal and reselect by dragging over a new area.">
            <span>{moment(event?.end).format('HH:mm YYYY-MM-DD')}</span>
          </Tooltip>
        </Form.Item>
        <Form.Item>
          <Checkbox
            checked={isRepeating}
            onChange={(e) => setIsRepeating(e.target.checked)}
          >
            Repeat Event
          </Checkbox>
        </Form.Item>

        {isRepeating ? (
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
        ) : (
          <Form.Item label="Event Day">
            <span>{moment(event?.start).format('dddd')}</span>
          </Form.Item>
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

export default CreateEventModal
