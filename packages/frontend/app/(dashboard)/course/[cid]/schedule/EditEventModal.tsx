import {
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Checkbox,
  Radio,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import moment from 'moment'
import { API } from '@/app/api'
import { calendarEventLocationType } from '@koh/common'
import { dayToIntMapping } from '@/app/typings/types'

const locationTypeMapping: { [key: string]: number } = {
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
  const [locationType, setLocationType] = useState<number>(0)
  const [selectedDays, setSelectedDays] = useState<number[]>([])

  useEffect(() => {
    if (event) {
      form.setFieldsValue({
        title: event.title,
        locationInPerson: event.locationInPerson,
        locationOnline: event.locationOnline,
        startTime: moment(event.start),
        endTime: moment(event.end),
        endDate: event.endRecur ? moment(event.endRecur) : null,
        locationType: locationTypeMapping[event.locationType] || 0,
      })
      setIsRepeating(!!event.endRecur)
      setLocationType(locationTypeMapping[event.locationType] || 0)
      if (event.daysOfWeek) {
        setSelectedDays(
          event.daysOfWeek.map((dayInt: number) => intToDayMapping[dayInt]),
        )
      }
    }
  }, [event, form])

  const intToDayMapping = Object.fromEntries(
    Object.entries(dayToIntMapping).map(([key, value]) => [value, key]),
  )

  const handleDaysChange = (checkedValues: any) => {
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
        start: formData.startTime.toISOString(),
        end: formData.endTime.toISOString(),
      }

      switch (locationType) {
        case 0:
          eventObject.locationType = calendarEventLocationType.inPerson
          eventObject.locationInPerson = formData.locationInPerson
          break
        case 1:
          eventObject.locationType = calendarEventLocationType.online
          eventObject.locationOnline = formData.locationOnline
          break
        case 2:
          eventObject.locationType = calendarEventLocationType.hybrid
          eventObject.locationInPerson = formData.locationInPerson
          eventObject.locationOnline = formData.locationOnline
          break
        default:
          message.error('Invalid location type')
          return
      }

      if (isRepeating) {
        if (formData.endDate && selectedDays) {
          eventObject.daysOfWeek = selectedDays.map(
            (day: number) => dayToIntMapping[day],
          )
          eventObject.startDate = moment().startOf('day').format('YYYY-MM-DD')
          eventObject.endDate = formData.endDate.format('YYYY-MM-DD')
        } else {
          message.error('Please select all fields for repeating events')
          return
        }
      }

      updateEvent(eventObject)
    } catch (validationError) {
      message.error('Event validation failed')
    }
  }

  const updateEvent = async (updatedEvent: any) => {
    try {
      const response = await API.calendar.patchEvent(event.id, updatedEvent)
      if (response) {
        console.log('Event updated successfully', response)
        message.success('Event updated successfully')
      } else {
        console.error('Failed to update event')
        message.error('Failed to update event')
      }
    } catch (err) {
      console.error('Error updating the event:', err)
      message.error('Error updating the event')
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

        <Form.Item
          label="Start Time"
          name="startTime"
          rules={[{ required: true, message: 'Please select the start time!' }]}
        >
          <TimePicker format="HH:mm" />
        </Form.Item>

        <Form.Item
          label="End Time"
          name="endTime"
          rules={[{ required: true, message: 'Please select the end time!' }]}
        >
          <TimePicker format="HH:mm" />
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
            <Form.Item
              label="End Date"
              name="endDate"
              rules={[
                { required: true, message: 'Please select the end date!' },
              ]}
            >
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
