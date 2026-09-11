'use client'

import { useState } from 'react'
import { Alert, Button, Input, message } from 'antd'
import axios from 'axios'
import type { EmbeddableQuestionFeedback } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const { TextArea } = Input

interface EmbeddableQuestionFeedbackProps {
  courseId: number
  questionId: number
  questionText: string
}

export default function EmbeddableQuestionFeedback({
  courseId,
  questionId,
  questionText,
}: EmbeddableQuestionFeedbackProps) {
  const [inputText, setInputText] = useState('')
  const [feedback, setFeedback] = useState<EmbeddableQuestionFeedback | null>(
    null,
  )
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
      const response = await API.lti.embeddableQuestion.getFeedback(
        courseId,
        questionId,
        trimmed,
      )
      setFeedback(response)
    } catch (err) {
      const statusMessages: Record<number, string> = {
        401: 'Your HelpMe session has expired. Reopen this quiz in Canvas to continue.',
        429: 'Too many attempts. Please wait a few minutes before requesting more feedback.',
      }
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const statusMessage =
        status !== undefined ? statusMessages[status] : undefined
      if (statusMessage) {
        setError(statusMessage)
        message.warning(statusMessage)
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
        aria-label="Your response"
        placeholder="Type your response here..."
        rows={4}
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

      {feedback && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-700">
            {`Provisional score: ${feedback.score}/${feedback.maxScore}`}
          </p>
          <div className="w-full whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
            {feedback.comment}
          </div>
          {feedback.appliedRequirements.length > 0 && (
            <div>
              <p className="text-sm font-medium text-zinc-700">
                Applied requirements
              </p>
              <ul className="mb-0 list-disc pl-5 text-xs text-zinc-600">
                {feedback.appliedRequirements.map((requirement, index) => (
                  <li key={`${requirement}-${index}`}>{requirement}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-zinc-500">
            This is provisional feedback only; it is not your final grade.
          </p>
        </div>
      )}
    </div>
  )
}
