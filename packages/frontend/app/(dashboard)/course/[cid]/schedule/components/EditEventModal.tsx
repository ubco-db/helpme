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
import moment from 'moment'
import { API } from '@/app/api'
import { Event } from '@/app/typings/types'
import { calendarEventLocationType } from '@koh/common'
import { dayToIntMapping } from '@/app/typings/types'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { DeleteOutlined } from '@ant-design/icons'

const locationTypeMapping: { [key: string]: number } = {
  'in-person': 0,
  online: 1,
  hybrid: 2,
}

interface FormValues {
  title: string
  locationType: number
  locationInPerson: string
  locationOnline: string
  endDate: moment.Moment
  startTime: moment.Moment
  endTime: moment.Moment
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
  const [form] = Form.useForm()
  const [isRepeating, setIsRepeating] = useState(false)
  const [locationType, setLocationType] = useState<number>(0)
  const [selectedDays, setSelectedDays] = useState<number[]>([])

  const intToDayMapping = Object.fromEntries(
    Object.entries(dayToIntMapping).map(([key, value]) => [value, key]),
  )

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
  }, [event, form, intToDayMapping])

  const handleDaysChange = (checkedValues: any) => {
    if (!checkedValues.includes(moment(event?.start).format('dddd'))) {
      checkedValues.push(moment(event?.start).format('dddd'))
    }
    setSelectedDays(checkedValues)
  }

  const onFinish = async (values: FormValues) => {
    console.log('values', values)
    try {
      const eventObject: Event = {
        ...values,
        cid: courseId,
        start: values.startTime ? values.startTime.toISOString() : '',
        end: values.endTime.toISOString(),
      }

      switch (locationType) {
        case 0:
          eventObject.locationType = calendarEventLocationType.inPerson
          eventObject.locationInPerson = values.locationInPerson
          break
        case 1:
          eventObject.locationType = calendarEventLocationType.online
          eventObject.locationOnline = values.locationOnline
          break
        case 2:
          eventObject.locationType = calendarEventLocationType.hybrid
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
            (day: number) => dayToIntMapping[day],
          )
          if (moment.isMoment(values.endDate)) {
            eventObject.endDate = values.endDate.format('YYYY-MM-DD')
          }
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
    if (!event) {
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

  const updateEvent = async (updatedEvent: any) => {
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

export default EditEventModal
