import { AsyncQuestion, Question, QueuePartial } from '@koh/common'

export function getWaitTime(question: Question): string {
  if (!question.createdAt) {
    return formatWaitTime(0)
  }
  // A dirty fix until we can get the serializer working properly again (i renamed `questions` in SSEQueueResponse to `queueQuestions` and renamed `queue` in ListQuestionsResponse to `questions` and stuff broke for some reason)
  if (typeof question.createdAt === 'string') {
    const now = new Date()
    const tempDate = new Date(Date.parse(question.createdAt))
    const difference = now.getTime() - tempDate.getTime()
    return formatWaitTime(difference / 60000)
  }
  const now = new Date()
  const difference = now.getTime() - question.createdAt.getTime()
  return formatWaitTime(difference / 60000)
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
