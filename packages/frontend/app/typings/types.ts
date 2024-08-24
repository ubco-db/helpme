export interface LayoutProps {
  children: React.ReactNode
}

export interface Event {
  id?: number
  title: string
  start: Date
  end: Date
  startDate?: Date | null
  locationType: string
  locationInPerson: string | null
  locationOnline: string | null
  endRecur?: Date | null
  daysOfWeek?: string[] | null
  startTime?: string | null
  endTime?: string | null
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
