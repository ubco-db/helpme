export interface LayoutProps {
  children: React.ReactNode
}

/**
 * Sorta like a mini FullCalendarEvent
 */
export interface Event {
  id?: number
  title: string
  start: Date
  end: Date
  startDate?: Date | null
  locationType: string
  locationInPerson: string | null
  locationOnline: string | null
  startRecur?: Date | null
  endRecur?: Date | null
  daysOfWeek?: string[] | null
  startTime?: string | null
  endTime?: string | null
}

/**
 * This is basically a kinda scuffed version of the FullCalendar Event type (it has more any types than the actual one since we don't have access to all their types).
 * More details about what each thing does here https://fullcalendar.io/docs/event-object
 */
export interface FullCalendarEvent {
  source?: any | null
  start?: Date | null
  end?: Date | null
  startStr?: string
  endStr?: string
  id?: string
  groupId?: string
  allDay?: boolean
  title?: string
  url?: string
  display?: string
  startEditable?: boolean
  durationEditable?: boolean
  constraint?: any
  overlap?: boolean
  allow?: any
  backgroundColor?: string
  borderColor?: string
  textColor?: string
  classNames?: string[]
  extendedProps?: any
  setProp?(name: string, val: any): void
  setExtendedProp?(name: string, val: any): void
  setStart?(
    startInput: any,
    options?: {
      granularity?: string
      maintainDuration?: boolean
    },
  ): void
  setEnd?(
    endInput: any | null,
    options?: {
      granularity?: string
    },
  ): void
  setDates?(
    startInput: any,
    endInput: any | null,
    options?: {
      allDay?: boolean
      granularity?: string
    },
  ): void
  moveStart?(deltaInput: any): void
  moveEnd?(deltaInput: any): void
  moveDates?(deltaInput: any): void
  setAllDay?(
    allDay: boolean,
    options?: {
      maintainDuration?: boolean
    },
  ): void
  formatRange?(formatInput: any): any
  remove?(): void
  toPlainObject?(settings?: {
    collapseExtendedProps?: boolean
    collapseColor?: boolean
  }): any
  toJSON?(): any
  studentsHelped?: number // used as a custom property for the TA checkin/checkout times page. Accessed with extendedProps
}

export const dayToIntMapping: { [key: string]: string } = {
  Sunday: '0',
  Monday: '1',
  Tuesday: '2',
  Wednesday: '3',
  Thursday: '4',
  Friday: '5',
  Saturday: '6',
}
