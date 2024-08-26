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
import { API } from '@/app/api'
import { calendarEventLocationType } from '@koh/common'
import { dayToIntMapping } from '@/app/typings/types'
import { getErrorMessage } from '@/app/utils/generalUtils'
import dayjs from 'dayjs'
type CreateEventModalProps = {
  visible: boolean
  onClose: () => void
  courseId: number
  event: { start: Date; end: Date } | undefined
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({
  event,
  visible,
  onClose,
  courseId,
}) => {
  const [form] = Form.useForm()
  const [isRepeating, setIsRepeating] = useState(false)
  const [locationType, setLocationType] = useState(0)
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  useEffect(() => {
    // reset the form to its default state when modal is closed
    if (!visible) {
      setIsRepeating(false)
      setLocationType(0)
      setSelectedDays([])
    }
  }, [visible])

  useEffect(() => {
    //default to the day of the event(create event object)
    setSelectedDays([dayjs(event?.start).format('dddd')])
  }, [event])
  const handleDaysChange = (checkedValues: any) => {
    if (!checkedValues.includes(dayjs(event?.start).format('dddd'))) {
      checkedValues.push(dayjs(event?.start).format('dddd'))
    }
    setSelectedDays(checkedValues)
  }
  const onFinish = async (values: any) => {
    try {
      const eventObject = {
        ...values,
        cid: courseId,
        title: values.title,
        end: dayjs(event?.end).toISOString(),
        start: dayjs(event?.start).toISOString(),
      }
      // Set the location type based on the value of locationType
      switch (locationType) {
        case 0: // In Person
          eventObject.locationType = calendarEventLocationType.inPerson
          eventObject.locationInPerson = values.locationInPerson
          break
        case 1: // Online
          eventObject.locationType = calendarEventLocationType.online
          eventObject.locationOnline = values.locationOnline
          break
        case 2: // Hybrid
          eventObject.locationType = calendarEventLocationType.hybrid
          eventObject.locationInPerson = values.locationInPerson
          eventObject.locationOnline = values.locationOnline
          break
        default:
          message.error('Invalid location type')
          return // Prevents the function from continuing
      }

      // Logic for repeating events
      if (isRepeating) {
        if (values.startDate && values.endDate && selectedDays) {
          eventObject.daysOfWeek = selectedDays.map(
            (day) => dayToIntMapping[day],
          )
          eventObject.startDate = values.startDate.toDate()
          eventObject.endDate = values.endDate.toDate()
        } else {
          message.error('Please select all fields for repeating events')
          return
        }
      }

      createEvent(eventObject)
    } catch (validationError) {
      const errorMessage = getErrorMessage(validationError)
      message.error('Event validation failed: ' + errorMessage)
    }
  }

  const createEvent = async (newEvent: any) => {
    try {
      const response = await API.calendar.addCalendar(newEvent, courseId)
      if (response) {
        message.success('Event created successfully')
        form.resetFields()
        onClose()
      } else {
        message.error('Failed to create event')
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      message.error('Error creating the event: ' + errorMessage)
    }
  }

  return (
    <Modal
      open={visible}
      title="Create a new event"
      okText="Create"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
      }}
      destroyOnClose
      onCancel={onClose}
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{ locationType: 0 }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        label="Title"
        name="title"
        rules={[{ required: true, message: 'Please input the title!' }]}
      >
        <Input />
      </Form.Item>

      <Form.Item label="Start Time">
        <Tooltip title="To change the time, exit this modal and reselect by dragging over a new area.">
          <span>{dayjs(event?.start).format('YYYY-MM-DD HH:mm')}</span>
        </Tooltip>
      </Form.Item>
      <Form.Item label="End Time">
        <Tooltip title="To change the time, exit this modal and reselect by dragging over a new area.">
          <span>{dayjs(event?.end).format('YYYY-MM-DD HH:mm')}</span>
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
          <Form.Item label="Start Date" name="startDate">
            <DatePicker picker="date" />
          </Form.Item>
          <Form.Item label="End Date" name="endDate">
            <DatePicker picker="date" />
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
          <span>{dayjs(event?.start).format('dddd')}</span>
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
            rules={[{ required: true, message: 'Please input the location!' }]}
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
    </Modal>
  )
}

export default CreateEventModal
