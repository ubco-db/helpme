'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Alert, Button, Card, Radio, Typography } from 'antd'
import useSWRImmutable from 'swr/immutable'
import { API } from '@/app/api'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { getErrorMessage } from '@/app/utils/generalUtils'

const { Paragraph, Text } = Typography

export default function DeepLinkPage() {
  const searchParams = useSearchParams()
  const ltik = searchParams.get('ltik') ?? ''
  const [selectedId, setSelectedId] = useState<number>()

  const { data: questions, error } = useSWRImmutable(
    ltik ? `lti/deep-link/questions/${ltik}` : null,
    () => API.lti.deepLink.getQuestions(ltik),
    { shouldRetryOnError: false, revalidateOnFocus: false },
  )

  const backendMessage: unknown = error ? getErrorMessage(error) : undefined
  const errorMessage = !ltik
    ? 'This page must be opened from Canvas.'
    : error
      ? typeof backendMessage === 'string' && backendMessage.trim()
        ? backendMessage
        : 'Could not load questions. Please reopen the tool and try again.'
      : undefined

  if (errorMessage) {
    return (
      <div className="flex w-full justify-center px-2 py-6">
        <Alert
          type="error"
          message="Could not open the question picker"
          description={errorMessage}
          showIcon
        />
      </div>
    )
  }

  if (!questions) {
    return <CenteredSpinner tip="Loading questions..." />
  }

  if (questions.length === 0) {
    return (
      <div className="flex w-full justify-center px-2 py-6">
        <Alert
          type="info"
          message="No questions to insert"
          description="This course has no embeddable questions yet. Create one in the HelpMe course settings first."
          showIcon
        />
      </div>
    )
  }

  return (
    <>
      <title>HelpMe | Insert question</title>
      <div className="flex w-full justify-center px-2 py-4">
        <Card title="Insert HelpMe question" className="w-full max-w-2xl">
          <Paragraph>
            Select a question to insert into Canvas. Students may need to sign
            in to HelpMe or create an account, then reopen the question in
            Canvas.
          </Paragraph>
          {/* Native POST so the signed response document auto-submits to Canvas */}
          <form method="POST" action={API.lti.deepLink.selectAction(ltik)}>
            <input type="hidden" name="questionId" value={selectedId ?? ''} />
            <Radio.Group
              aria-label="HelpMe questions"
              className="flex w-full flex-col gap-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {questions.map((q) => (
                <Radio key={q.id} value={q.id}>
                  <Text strong>{q.title || `Question ${q.id}`}</Text>
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    type="secondary"
                    className="mb-0"
                  >
                    {q.questionText}
                  </Paragraph>
                </Radio>
              ))}
            </Radio.Group>
            <Button
              type="primary"
              htmlType="submit"
              disabled={selectedId === undefined}
              className="mt-4"
            >
              Insert into Canvas
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}
