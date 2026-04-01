'use client'

import React, { useState } from 'react'
import { Alert, Button, Input, message, Spin } from 'antd'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const { TextArea } = Input

export interface SelfAssessmentQuestionFeedbackProps {
  courseId: number
  /** The question text - displayed to the student and sent to the AI for context */
  questionText?: string
  placeholder?: string
}

export default function SelfAssessmentQuestionFeedback({
  courseId,
  questionText,
  placeholder = 'Type your response here...',
}: SelfAssessmentQuestionFeedbackProps): React.ReactElement {
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
      // Include question context so the AI can evaluate the answer
      const query = questionText?.trim()
        ? `Question: ${questionText.trim()}\n\nStudent's response: ${trimmed}`
        : trimmed

      const response = await API.chatbot.studentsOrStaff.queryChatbot(
        courseId,
        { query, type: 'default' },
      )
      setFeedback(response)
    } catch (err) {
      const errMsg = getErrorMessage(err)
      setError(typeof errMsg === 'string' ? errMsg : 'Failed to get feedback.')
      message.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {questionText && (
        <p className="text-sm font-medium text-zinc-700">{questionText}</p>
      )}

      <TextArea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={placeholder}
        rows={5}
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
