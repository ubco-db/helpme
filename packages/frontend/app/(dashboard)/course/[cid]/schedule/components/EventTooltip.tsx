import { Popconfirm, Tooltip } from 'antd'
import { format } from 'date-fns'
import {
  calendarEventLocationType,
  getCalendarEventLocationTypeFormatted,
} from '@koh/common'
import { Event, FullCalendarEvent } from '@/app/typings/types'

type EventTooltipProps = {
  info: any // should be EventContentArg but it's not exported from FullCalendar
}

const EventTooltip: React.FC<EventTooltipProps> = ({ info }) => {
  const event = info.event as FullCalendarEvent // should be EventImpl but it's not exported from FullCalendar
  const extendedProps = info.event.extendedProps as Event // note that it is a subset of Event. Stuff like start and end are already in info.event
  const formattedStart = event.start ? format(event.start, 'h:mm') : ''
  const formattedEnd = event.end ? format(event.end, 'h:mm') : ''
  const formattedStartWithAmPm = event.start
    ? format(event.start, 'h:mmaaa')
    : ''
  const formattedEndWithAmPm = event.end ? format(event.end, 'h:mmaaa') : ''

  return (
    <Tooltip
      title={
        <div>
          <p className="text-base">{event.title}</p>
          <p>
            {formattedStartWithAmPm} - {formattedEndWithAmPm}
          </p>
          <p>
            {getCalendarEventLocationTypeFormatted(extendedProps.locationType)}
          </p>
          {extendedProps.locationType !== calendarEventLocationType.online &&
            extendedProps.locationInPerson && (
              <p>Location: {extendedProps.locationInPerson}</p>
            )}
          {extendedProps.locationType !== calendarEventLocationType.inPerson &&
            extendedProps.locationOnline && (
              <p className="whitespace-nowrap">
                Link:{' '}
                <Popconfirm
                  title="Are you sure you want to open this link?"
                  getPopupContainer={(trigger) =>
                    trigger.parentNode as HTMLElement
                  }
                  okText="Yes"
                  cancelText="No"
                  okButtonProps={{
                    href: extendedProps.locationOnline,
                    target: '_blank',
                    rel: 'noreferrer',
                    className: 'ml-3 px-4',
                  }}
                  cancelButtonProps={{ className: 'px-4' }}
                >
                  <a className="whitespace-normal">
                    {extendedProps.locationOnline}
                  </a>
                </Popconfirm>
              </p>
            )}
          {extendedProps.staffNames && extendedProps.staffNames.length > 0 && (
            <p>Assigned Staff: {extendedProps.staffNames.join(', ')}</p>
          )}
        </div>
      }
    >
      <div className="flex h-full max-h-full flex-col gap-y-0.5 overflow-hidden">
        <p className="font-weight-lighter text-xs">
          {formattedStart} - {formattedEnd}
        </p>
        <p>{event.title}</p>
        <p className="text-xs">
          {extendedProps.locationType !== calendarEventLocationType.inPerson &&
            getCalendarEventLocationTypeFormatted(extendedProps.locationType)}
        </p>
        <p className="text-xs">
          {extendedProps.locationType !== calendarEventLocationType.online &&
            extendedProps.locationInPerson}
        </p>
      </div>
    </Tooltip>
  )
}

export default EventTooltip
