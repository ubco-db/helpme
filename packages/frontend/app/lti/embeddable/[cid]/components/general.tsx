import { Card } from 'antd'
import React, { useMemo } from 'react'
import { EmbeddableAssignment, EmbeddableQuestion } from '@koh/common'

const dateFormat: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: 'numeric',
  minute: 'numeric',
  timeZoneName: 'short',
}

const DateIssue: React.FC<{ mode: 'assignment' | 'question', item: EmbeddableQuestion | EmbeddableAssignment, type: 'late' | 'early' }> = ({
  mode,
  item,
  type,
}) => {
  const title = useMemo(() => {
    const name = mode == 'question' ? 'Question' : 'Assessment'
    return type == 'late' 
      ? `This ${name} has closed.`
      : `This ${name} has not opened yet.`
  }, [mode, type])
  
  const text = useMemo(() => {
    const name = mode == 'question' ? 'question' : 'assessment'
    return type == 'early'
      ? `This ${name} is not available yet. It will become available after ${new Date(item.availableFrom ?? Date.now()).toLocaleDateString('en-US', dateFormat)}.`
      : `This ${name} is no longer available. It closed after ${new Date(item.availableUntil ?? Date.now()).toLocaleDateString('en-US', dateFormat)}.`
  }, [mode,item,type])
  
  return (
    <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
      <Card title={title}>
        <p className={'font-bold text-zinc-400'}>
          {text}
        </p>
      </Card>
    </div>
  )
}

const ErrorMessage: React.FC<{ mode: 'assignment' | 'question', error?: string, item?: EmbeddableQuestion | EmbeddableAssignment }> = ({
  mode,
  error,
}) => {
  const title = useMemo(() => {
    const name = mode == 'question' ? 'Question' : 'Assessment'
    return `Error loading ${name}`
  }, [mode])

  const message = useMemo(() => {
    const name = mode == 'question' ? 'Question' : 'Assessment'
    return `${error || `${name} not found.`} Please let your professor know.`
  }, [error, mode])
  
  return (
    <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
      <Card title={title}>
        <p className="text-zinc-600">
          {error || 'Question not found.'} Please let your professor know.
        </p>
      </Card>
    </div>
  )
}

export {
  DateIssue,
  ErrorMessage
}