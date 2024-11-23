import {
  AsyncQuestion,
  OpenQuestionStatus,
  Question,
  QueuePartial,
} from '@koh/common'

export function getWaitTime(question: Question): string {
  const lastReadyDate = question.lastReadyAt
    ? typeof question.lastReadyAt === 'string'
      ? new Date(Date.parse(question.lastReadyAt))
      : question.lastReadyAt
    : question.createdAt
      ? typeof question.createdAt === 'string'
        ? new Date(Date.parse(question.createdAt))
        : question.createdAt
      : null
  if (!lastReadyDate) {
    return formatWaitTime(0)
  }
  const now = new Date()
  const actualWaitTimeSecs =
    question.waitTime +
    Math.round((now.getTime() - lastReadyDate.getTime()) / 1000)
  console.log('question.waitTime', question.waitTime)
  console.log('actualWaitTimeSecs', actualWaitTimeSecs)
  return formatWaitTime(actualWaitTimeSecs / 60)
}

export function getAsyncWaitTime(question: AsyncQuestion): string {
  const now = new Date()
  const createdAt = new Date(question.createdAt)
  const differenceInMinutes = (now.getTime() - createdAt.getTime()) / 60000
  if (differenceInMinutes < 60) {
    return formatWaitTime(differenceInMinutes)
  } else if (differenceInMinutes < 60 * 24) {
    return `${Math.floor(differenceInMinutes / 60)}h`
  } else {
    // format in days if it's been more than a day
    const days = Math.floor(differenceInMinutes / (60 * 24))
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
}

export function formatWaitTime(minutes: number): string {
  const m = Math.floor(minutes)
  if (m <= 0) {
    return '0 min'
  } else if (m % 60 == 0) {
    return `${Math.floor(m / 60)}h`
  } else if (m >= 60) {
    return `${Math.floor(m / 60)}h ${Math.floor(m) % 60}m`
  } else {
    return `${Math.floor(m)} min`
  }
}

export function getServedTime(question: Question): string {
  if (!question.helpedAt) {
    return ''
  }
  const now = new Date()
  let actualServeTimeSecs = 0
  // A dirty fix until we can get the serializer working properly again (i renamed `questions` in SSEQueueResponse to `queueQuestions` and renamed `queue` in ListQuestionsResponse to `questions` and stuff broke for some reason)
  if (question.status === OpenQuestionStatus.Paused) {
    actualServeTimeSecs = question.helpTime
  } else if (typeof question.helpedAt === 'string') {
    const tempDate = new Date(Date.parse(question.helpedAt))
    actualServeTimeSecs =
      question.helpTime +
      Math.round((now.getTime() - tempDate.getTime()) / 1000)
  } else {
    actualServeTimeSecs =
      question.helpTime +
      Math.round((now.getTime() - question.helpedAt.getTime()) / 1000)
  }
  return formatServeTime(actualServeTimeSecs)
}

/**
 * Formats time as 0:11 (minutes:seconds)
 */
export function formatServeTime(time: number): string {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Note: this doesn't seem to be used anywhere
export function formatQueueTime(queue: QueuePartial): string {
  if (!queue.startTime || !queue.endTime) {
    return ''
  }
  return formatDateTime(queue.startTime) + ' - ' + formatDateTime(queue.endTime)
}

function formatDateTime(date: Date) {
  let hours = date.getHours()
  let minutes: any = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes
  return hours + ':' + minutes + ' ' + ampm
}

export function formatDateHour(hours: number): string {
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  return hours + ampm
}

export function formatDateAndTimeForExcel(date: Date | undefined): string {
  if (date === undefined) return ''

  const validDate = typeof date === 'string' ? new Date(date) : date
  if (!validDate || isNaN(validDate.getTime())) return ''
  // Convert to local time and extract parts
  const localDate = new Date(
    validDate.getTime() - validDate.getTimezoneOffset() * 60_000,
  )
  const [datePart, timePart] = localDate.toISOString().split('T')
  const timeString = timePart.split('.')[0] // Remove milliseconds
  return `${datePart} ${timeString}` // Format: YYYY-MM-DD HH:MM:SS
}
