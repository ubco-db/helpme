import {
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Checkbox,
  Radio,
  message,
  Button,
  Popconfirm,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { API } from '@/app/api'
import { Event } from '@/app/typings/types'
import { Calendar, calendarEventLocationType } from '@koh/common'
import { dayToIntMapping } from '@/app/typings/types'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { DeleteOutlined } from '@ant-design/icons'

interface FormValues {
  title: string
  startTime: Date
  endTime: Date
  startDate?: Date
  endDate?: Date
  locationType: calendarEventLocationType
  locationInPerson?: string
  locationOnline?: string
  repeatDays?: string[]
}

type EditEventModalProps = {
  visible: boolean
  onClose: () => void
  event: Event
  courseId: number
}

const EditEventModal: React.FC<EditEventModalProps> = ({
  visible,
  onClose,
  event,
  courseId,
}) => {
  const [form] = Form.useForm<FormValues>()
  const [isRepeating, setIsRepeating] = useState(false)
  const [locationType, setLocationType] = useState<calendarEventLocationType>(
    calendarEventLocationType.inPerson,
  )
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  const intToDayMapping = Object.fromEntries(
    Object.entries(dayToIntMapping).map(([key, value]) => [value, key]),
  )

  useEffect(() => {
    if (event) {
      if (event.endRecur) {
        setIsRepeating(true)
      }
      form.setFieldsValue({
        title: event.title,
        locationInPerson: event.locationInPerson || undefined,
        locationOnline: event.locationOnline || undefined,
        startTime: dayjs(event.start),
        endTime: dayjs(event.end),
        startDate: event.endRecur ? dayjs(event.startDate) : undefined,
        endDate: event.endRecur ? dayjs(event.endRecur) : undefined,
        locationType: event.locationType as calendarEventLocationType,
      })
      setLocationType(event.locationType as calendarEventLocationType)
      setSelectedDays((prevDays) =>
        event.daysOfWeek
          ? event.daysOfWeek.map((dayInt) => intToDayMapping[dayInt])
          : prevDays,
      )
    }
  }, [event, form])

  const handleDaysChange = (checkedValues: string[]) => {
    setSelectedDays(checkedValues)
  }

  const onFinish = async (values: any) => {
    try {
      const eventObject: Partial<Calendar> = {
        cid: courseId,
        title: values.title,
        start: values.startTime.toDate(),
        end: values.endTime.toDate(),
        locationType: values.locationType,
      }

      switch (values.locationType) {
        case calendarEventLocationType.inPerson:
          eventObject.locationInPerson = values.locationInPerson
          eventObject.locationOnline = undefined
          break
        case calendarEventLocationType.online:
          eventObject.locationOnline = values.locationOnline
          eventObject.locationInPerson = undefined
          break
        case calendarEventLocationType.hybrid:
          eventObject.locationInPerson = values.locationInPerson
          eventObject.locationOnline = values.locationOnline
          break
        default:
          message.error('Invalid location type')
          return
      }

      if (isRepeating) {
        if (values.endDate && selectedDays) {
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

      updateEvent(eventObject)
    } catch (validationError) {
      message.error('Event validation failed')
    }
  }

  const deleteEvent = useCallback(async () => {
    if (!event?.id) {
      message.error('Event not found')
      return
    }
    try {
      const response = await API.calendar.deleteEvent(event.id)
      if (response) {
        message.success('Event deleted successfully')
        onClose()
      } else {
        message.error('Failed to delete event')
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      message.error('Error deleting the event: ' + errorMessage)
    }
  }, [event, onClose])

  const updateEvent = async (updatedEvent: Partial<Calendar>) => {
    if (!event?.id) {
      message.error('Event not found')
      return
    }
    try {
      const response = await API.calendar.patchEvent(event.id, updatedEvent)
      if (response) {
        message.success('Event updated successfully')
      } else {
        message.error('Failed to update event')
      }
    } catch (err) {
      message.error('Error updating the event')
    }
    onClose()
  }

  return (
    <Modal
      open={visible}
      title="Edit Event"
      okText="Save Changes"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
      }}
      destroyOnClose
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className="flex justify-between">
          <Popconfirm
            title="Are you sure you want to delete the event?"
            okText="Yes"
            cancelText="No"
            onConfirm={deleteEvent}
          >
            <Button danger type="primary" icon={<DeleteOutlined />}>
              Delete Event
            </Button>
          </Popconfirm>
          <div className="flex gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      )}
      onCancel={onClose}
      closable={false}
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
            label="Start Date"
            name="startDate"
            rules={[{ required: true, message: 'Please select the end date!' }]}
          >
            <DatePicker />
          </Form.Item>
          <Form.Item
            label="End Date"
            name="endDate"
            rules={[{ required: true, message: 'Please select the end date!' }]}
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
          <Radio value={calendarEventLocationType.inPerson}>In-Person</Radio>
          <Radio value={calendarEventLocationType.online}>Online</Radio>
          <Radio value={calendarEventLocationType.hybrid}>Hybrid</Radio>
        </Radio.Group>
      </Form.Item>

      {locationType === calendarEventLocationType.inPerson && (
        <Form.Item
          label="Location"
          name="locationInPerson"
          rules={[{ required: true, message: 'Please input the location!' }]}
        >
          <Input />
        </Form.Item>
      )}

      {locationType === calendarEventLocationType.online && (
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

      {locationType === calendarEventLocationType.hybrid && (
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

export default EditEventModal
