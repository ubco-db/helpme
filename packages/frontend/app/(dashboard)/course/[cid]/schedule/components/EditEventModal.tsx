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
  ColorPickerProps,
  GetProp,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { API } from '@/app/api'
import { Event } from '@/app/typings/types'
import { Calendar, calendarEventLocationType } from '@koh/common'
import { dayToIntMapping } from '@/app/typings/types'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { DeleteOutlined } from '@ant-design/icons'
import ColorPickerWithPresets from '@/app/components/ColorPickerWithPresets'

type Color = Extract<
  GetProp<ColorPickerProps, 'value'>,
  string | { cleared: any }
>

interface FormValues {
  title: string
  color: string | Color
  date: dayjs.Dayjs
  startTime: dayjs.Dayjs
  endTime: dayjs.Dayjs
  locationType: number | calendarEventLocationType
  locationInPerson?: string
  locationOnline?: string
  startDate?: dayjs.Dayjs
  endDate?: dayjs.Dayjs
  daysOfWeek?: string[]
}

type EditEventModalProps = {
  visible: boolean
  onClose: () => void
  event?: Event
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
    (event?.locationType as calendarEventLocationType) ||
      calendarEventLocationType.inPerson,
  )
  const intToDayMapping = Object.fromEntries(
    Object.entries(dayToIntMapping).map(([key, value]) => [value, key]),
  )

  useEffect(() => {
    if (event && visible) {
      if (event.endRecur) {
        setIsRepeating(true)
      } else {
        setIsRepeating(false)
      }
      setLocationType(event.locationType as calendarEventLocationType)
    }
  }, [visible, event])

  const onFinish = async (values: FormValues) => {
    try {
      const eventObject: Partial<Calendar> = {
        cid: courseId,
        title: values.title,
        start: values.startTime.toDate(),
        end: values.endTime.toDate(),
        locationType: values.locationType as calendarEventLocationType,
        color:
          typeof values.color === 'string'
            ? values.color
            : values.color.toHexString(),
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
        if (values.startDate && values.endDate && values.daysOfWeek) {
          eventObject.daysOfWeek = values.daysOfWeek.map(
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
      const response = await API.calendar.deleteEvent(event.id, courseId)
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
  }, [courseId, event, onClose])

  const updateEvent = async (updatedEvent: Partial<Calendar>) => {
    if (!event?.id) {
      message.error('Event not found')
      return
    }
    try {
      const response = await API.calendar.patchEvent(
        event.id,
        updatedEvent,
        courseId,
      )
      if (response) {
        message.success('Event updated successfully')
      } else {
        message.error('Failed to update event')
      }
    } catch (err) {
      message.error('Error updating the event')
    }
    console.log(updatedEvent)
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
          initialValues={{
            locationType: event
              ? event.locationType
              : calendarEventLocationType.inPerson,
            color:
              event && event.backgroundColor
                ? event.backgroundColor
                : '#3788d8',
            title: event ? event.title : '',
            startTime: event ? dayjs(event.start) : undefined,
            endTime: event ? dayjs(event.end) : undefined,
            locationInPerson: event ? event.locationInPerson : '',
            locationOnline: event ? event.locationOnline : '',
            daysOfWeek: event?.daysOfWeek
              ? event.daysOfWeek.map((dayInt) => intToDayMapping[dayInt])
              : [],
            startDate: event ? dayjs(event.startDate) : undefined,
            endDate: event ? dayjs(event.endRecur) : undefined,
          }}
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
        label="Color"
        layout="horizontal"
        valuePropName="color"
        name="color"
        rules={[{ required: true, message: 'Missing color' }]}
      >
        <ColorPickerWithPresets
          defaultValue={
            event && event.backgroundColor ? event.backgroundColor : '#3788d8'
          }
          format="hex"
          defaultFormat="hex"
          disabledAlpha
        />
      </Form.Item>

      <Form.Item
        label="Start Time"
        name="startTime"
        rules={[{ required: true, message: 'Please select the start time!' }]}
      >
        <TimePicker format="HH:mm" minuteStep={5} />
      </Form.Item>

      <Form.Item
        label="End Time"
        name="endTime"
        rules={[{ required: true, message: 'Please select the end time!' }]}
      >
        <TimePicker format="HH:mm" minuteStep={5} />
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
            dependencies={['endDate']}
            rules={[
              { required: true, message: 'Please select the start date!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue('endDate')) {
                    return Promise.resolve()
                  }
                  if (value.isBefore(getFieldValue('endDate'))) {
                    return Promise.resolve()
                  }
                  return Promise.reject(
                    new Error('Start date must be before end date!'),
                  )
                },
              }),
            ]}
          >
            <DatePicker />
          </Form.Item>
          <Form.Item
            label="End Date"
            name="endDate"
            dependencies={['startDate']}
            rules={[
              { required: true, message: 'Please select the end date!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !getFieldValue('startDate')) {
                    return Promise.resolve()
                  }
                  if (value.isAfter(getFieldValue('startDate'))) {
                    return Promise.resolve()
                  }
                  return Promise.reject(
                    new Error('End date must be after start date!'),
                  )
                },
              }),
            ]}
          >
            <DatePicker />
          </Form.Item>
          <Form.Item
            label="Repeat on"
            name="daysOfWeek"
            rules={[
              {
                required: true,
                message: 'Please select at least one day to repeat on',
              },
            ]}
          >
            <Checkbox.Group>
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
