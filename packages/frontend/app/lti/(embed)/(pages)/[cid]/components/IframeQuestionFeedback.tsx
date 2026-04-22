'use client'

import React, { useState } from 'react'
import { Alert, Button, Input, message, Spin } from 'antd'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const { TextArea } = Input

export interface IframeQuestionFeedbackProps {
  courseId: number
  questionId: number
  questionText: string
  placeholder?: string
}

// the form that students use in the iframe
// shows the question, text area, submit button, and then the ai feedback
export default function IframeQuestionFeedback({
  courseId,
  questionId,
  questionText,
  placeholder = 'Type your response here...',
}: IframeQuestionFeedbackProps): React.ReactElement {
  const [inputText, setInputText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = inputText.trim()
    if (!trimmed) {
      message.warning('Please enter your response before submitting.')
      return
    }

    setError(null)
    setFeedback(null)
    setIsLoading(true)

    try {
      const response = await API.iframeQuestion.getFeedbackPublic(
        courseId,
        questionId,
        trimmed,
      )
      setFeedback(response.feedback)
    } catch (err) {
      if ((err as any)?.response?.status === 429) {
        const rateLimitMessage =
          'Too many attempts. Please wait a few minutes before requesting more feedback.'
        setError(rateLimitMessage)
        message.warning(rateLimitMessage)
        return
      }

      const errMsg = getErrorMessage(err)
      setError(typeof errMsg === 'string' ? errMsg : 'Failed to get feedback.')
      message.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm font-medium text-zinc-700">{questionText}</p>

      <TextArea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={isLoading}
        className="resize-none"
      />

      <Button
        type="primary"
        onClick={handleSubmit}
        loading={isLoading}
        disabled={!inputText.trim() || isLoading}
      >
        Get Feedback
      </Button>

      {isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <Spin size="small" />
          <span className="text-sm text-zinc-600">Generating feedback...</span>
        </div>
      )}

      {error && (
        <Alert
          type="error"
          message="Error"
          description={error}
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      {feedback && !isLoading && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-700">Feedback</p>
          <div className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
            {feedback}
          </div>
        </div>
      )}
    </div>
  )
}
