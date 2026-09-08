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
  minSentences: number
  maxSentences: number
}

export default function EmbeddableQuestionFeedback({
  courseId,
  questionId,
  questionText,
  minSentences,
  maxSentences,
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
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const authMessage =
          'Your HelpMe session has expired. Reopen this quiz in Canvas to continue.'
        setError(authMessage)
        message.warning(authMessage)
        return
      }

      if (axios.isAxiosError(err) && err.response?.status === 429) {
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

  const sentenceRequirement =
    minSentences === maxSentences
      ? `${minSentences} sentence${minSentences === 1 ? '' : 's'}`
      : `${minSentences}-${maxSentences} sentences`

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm font-medium text-zinc-700">{questionText}</p>
      <p className="text-xs text-zinc-500">
        Suggested response length: {sentenceRequirement}.
      </p>

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

      {feedback && !isLoading && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-700">Feedback</p>
          <div className="w-full whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
            {feedback.comment}
          </div>
          <p className="text-sm font-medium text-zinc-700">
            {`Provisional score: ${feedback.score}/${feedback.maxScore}`}
          </p>
          <p className="text-xs text-zinc-500">
            This is feedback only, not your final grade. Submit the full quiz to
            receive your final grade.
          </p>
        </div>
      )}
    </div>
  )
}
