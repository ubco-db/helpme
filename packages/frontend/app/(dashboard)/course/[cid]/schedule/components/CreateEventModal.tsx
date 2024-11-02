import {
  Modal,
  Form,
  Input,
  DatePicker,
  Checkbox,
  Radio,
  message,
  TimePicker,
  Select,
  ColorPickerProps,
  GetProp,
} from 'antd'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { calendarEventLocationType, UserPartial } from '@koh/common'
import { dayToIntMapping } from '@/app/typings/types'
import { getErrorMessage } from '@/app/utils/generalUtils'
import dayjs from 'dayjs'
import ColorPickerWithPresets from '@/app/components/ColorPickerWithPresets'

const { RangePicker } = TimePicker
type Color = GetProp<ColorPickerProps, 'value'>

type CreateEventModalProps = {
  visible: boolean
  onClose: () => void
  courseId: number
  event: { start: Date; end: Date } | undefined
}

interface FormValues {
  title: string
  color: string | Color
  date: dayjs.Dayjs
  time: [dayjs.Dayjs, dayjs.Dayjs]
  locationType: number | calendarEventLocationType
  locationInPerson?: string
  locationOnline?: string
  startDate?: dayjs.Dayjs
  endDate?: dayjs.Dayjs
  daysOfWeek?: string[]
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
  const [staff, setStaff] = useState<UserPartial[] | null>(null)

  useEffect(() => {
    // reset the form to its default state when modal is closed
    if (!visible) {
      setIsRepeating(false)
      setLocationType(0)
    }
  }, [visible])

  useEffect(() => {
    const fetchStaff = async () => {
      const data = await API.course.getUserInfo(courseId, 1, 'staff')
      // sort staff by name
      data.users.sort((a, b) => {
        if (!a.name || !b.name) {
          return 0
        } else {
          return a.name.localeCompare(b.name)
        }
      })
      setStaff(data.users)
    }
    fetchStaff()
  }, [courseId])

  const onFinish = async (values: FormValues) => {
    try {
      // Remove the `time` and `date` attribute from `values`
      const { date, time, ...restValues } = values

      // Combine date with start time
      const startDateTime = dayjs(date)
        .set('hour', time[0].hour())
        .set('minute', time[0].minute())

      // Combine date with end time
      const endDateTime = dayjs(date)
        .set('hour', time[1].hour())
        .set('minute', time[1].minute())

      const eventObject: any = {
        ...restValues,
        cid: courseId,
        title: values.title,
        color:
          typeof values.color === 'string'
            ? values.color
            : values.color.toHexString(),
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
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
          initialValues={{
            locationType: 0,
            date: dayjs(event?.start),
            time: [dayjs(event?.start), dayjs(event?.end)],
            daysOfWeek: [dayjs(event?.start).format('dddd')],
            startDate: dayjs(event?.start),
            // end date to be start date + 4 months
            endDate: dayjs(event?.start).add(4, 'month'),
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
        initialValue="#3788d8"
      >
        <ColorPickerWithPresets
          defaultValue="#3788d8"
          format="hex"
          defaultFormat="hex"
          disabledAlpha
        />
      </Form.Item>

      <Form.Item
        label="Date"
        name="date"
        rules={[
          { required: true, message: 'Please select the date of the event' },
        ]}
      >
        <DatePicker />
      </Form.Item>
      <Form.Item
        label="Time"
        name="time"
        rules={[
          { required: true, message: 'Please select the times of the event' },
        ]}
      >
        <RangePicker
          // Don't show seconds, also show minutes in intervals of 5
          minuteStep={5}
          format="HH:mm"
          className="w-36"
        />
      </Form.Item>
      <Form.Item
        label="Staff"
        name="staffIds"
        tooltip={{
          title: (
            <div className="flex flex-col gap-y-2">
              <p>
                Select staff members that should be checked into a queue at this
                time.
              </p>
              <p>
                At the end, staff will have an option to stay a bit longer or
                will otherwise be auto-checked out after 10mins.
              </p>
              <p>
                This also will keep track if staff are checking in late (or
                completely miss their session), shown on the TA Check In/Out
                Times page in Course Settings.
              </p>
            </div>
          ),
          overlayStyle: { maxWidth: '25rem' },
        }}
      >
        <Select
          placeholder="Select Staff"
          mode="multiple"
          options={staff?.map((staff) => ({
            label: staff.name,
            value: staff.id,
          }))}
          loading={staff === null}
          style={{ width: '100%' }}
          allowClear
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
          <Form.Item
            label="Start Date"
            name="startDate"
            dependencies={['endDate']}
            rules={[
              {
                required: true,
                message: 'Please select the start date of this repeating event',
              },
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
            <DatePicker picker="date" />
          </Form.Item>
          <Form.Item
            label="End Date"
            name="endDate"
            dependencies={['startDate']}
            rules={[
              {
                required: true,
                message: 'Please select the end date of this repeating event',
              },
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
            <DatePicker picker="date" />
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
