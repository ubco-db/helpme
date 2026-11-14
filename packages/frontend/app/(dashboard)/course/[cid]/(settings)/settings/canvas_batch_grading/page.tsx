'use client'

import { use, useState, type ReactElement } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Progress,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import useSWRImmutable from 'swr/immutable'
import { CanvasBatchRunStatus } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import Link from 'next/link'

const POLL_INTERVAL_MS = 3000

export default function CanvasBatchGradingPage({
  params,
}: {
  params: Promise<{ cid: string }>
}): ReactElement {
  const courseId = Number(use(params).cid)
  const [selectedQuizId, setSelectedQuizId] = useState<number>()
  const [selectedRun, setSelectedRun] = useState<{
    quizId: number
    runId: number
  }>()
  const [starting, setStarting] = useState(false)

  const quizzesRequest = useSWRImmutable(
    `canvasBatch/quizzes/${courseId}`,
    () => API.lti.canvasBatch.getQuizzes(courseId),
  )
  const runsRequest = useSWRImmutable(`canvasBatch/runs/${courseId}`, () =>
    API.lti.canvasBatch.getRuns(courseId),
  )
  const quizzes = quizzesRequest.data ?? []
  const runs = runsRequest.data ?? []
  const selectedQuiz = quizzes.find(
    (quiz) => quiz.canvasQuizId === selectedQuizId,
  )
  const latestRun = runs.find((run) => run.canvasQuizId === selectedQuizId)
  const activeRunId =
    selectedRun?.quizId === selectedQuizId ? selectedRun?.runId : latestRun?.id

  const reportRequest = useSWRImmutable(
    activeRunId
      ? (['canvasBatch/report', courseId, activeRunId] as const)
      : null,
    ([, courseId, runId]) => API.lti.canvasBatch.getReport(courseId, runId),
    {
      refreshInterval: (report) =>
        report?.run.status === CanvasBatchRunStatus.Running
          ? POLL_INTERVAL_MS
          : 0,
    },
  )
  const report =
    reportRequest.data?.run.canvasQuizId === selectedQuizId
      ? reportRequest.data
      : undefined
  const run = report?.run
  const isFailed = run?.status === CanvasBatchRunStatus.Failed
  const isRunning = run?.status === CanvasBatchRunStatus.Running
  const isResuming =
    run?.id === latestRun?.id
      ? isRunning
      : latestRun?.status === CanvasBatchRunStatus.Running
  const questionCount = selectedQuiz?.essayQuestions.length ?? 0
  const blockingReason = !selectedQuiz ? null : questionCount === 0 ? (
    'This Canvas quiz has no essay questions.'
  ) : !selectedQuiz.postManually ? (
    <>
      <p>
        <Link
          href="https://community.instructure.com/en/kb/articles/660845-how-do-i-select-a-grade-posting-policy-for-an-assignment-in-the-gradebook"
          target="_blank"
          rel="noopener noreferrer"
        >
          Set this assignment's Grade Posting Policy to 'Manual'
        </Link>{' '}
        in order to grade this quiz: Under "Grades" on the sidebar -&gt; Find
        the assignment listed as a column header and hover and click on its 3
        dots -&gt; "Grade Posting Policy" -&gt; set to "Manually" -&gt; Save.
      </p>
      <p>Then, reload this page.</p>
    </>
  ) : (
    selectedQuiz.mappingError
  )
  const canStart =
    selectedQuiz != null &&
    selectedQuiz.postManually &&
    (isResuming || blockingReason == null)

  const start = async () => {
    if (!selectedQuiz) return
    setStarting(true)
    try {
      const started = await API.lti.canvasBatch.startRun(courseId, {
        canvasQuizId: selectedQuiz.canvasQuizId,
      })
      setSelectedRun({ quizId: started.canvasQuizId, runId: started.id })
      message.success(
        isResuming
          ? 'Grading resumed.'
          : 'Grading started. HelpMe is prefilling SpeedGrader.',
      )
      void runsRequest.mutate()
    } catch (error) {
      message.error(`Failed to start grading: ${getErrorMessage(error)}`)
    } finally {
      setStarting(false)
    }
  }

  const counts = run?.counts
  const hasErrors = isFailed || (counts?.errors ?? 0) > 0
  const flags = report?.flags ?? []
  const total = counts?.questions ?? 0
  const percent =
    run && !isRunning
      ? 100
      : total
        ? Math.round(
            (((counts?.posted ?? 0) + (counts?.skipped ?? 0)) / total) * 100,
          )
        : 0
  const loadError = quizzesRequest.error ?? runsRequest.error

  return (
    <Card title="Canvas Batch Grading" classNames={{ body: 'p-3 md:p-6' }}>
      <ol className="mb-4 list-inside list-decimal text-gray-600">
        <li>Select a published Classic Canvas quiz.</li>
        <li>
          HelpMe detects its Embedded Questions (need link) and uses the prompts
          you provided to prefill the SpeedGrader.
        </li>
        <li>You review and post grades in Canvas.</li>
        <li>
          Make sure to review all submission comments to check for any "HUMAN
          REVIEW REQUIRED" comments (delete them afterwards).
        </li>
      </ol>
      <Alert
        className="mb-4"
        type="warning"
        showIcon
        message="Do not edit this quiz while prefill is running."
      />
      {loadError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Failed to load Canvas quizzes"
          description={getErrorMessage(loadError)}
          action={
            <Button
              onClick={() => {
                void quizzesRequest.mutate()
                void runsRequest.mutate()
              }}
            >
              Retry
            </Button>
          }
        />
      )}

      {reportRequest.error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Could not refresh grading progress"
          description={`The run may still be processing. Retry to see its current status before posting grades. ${getErrorMessage(reportRequest.error)}`}
          action={
            <Button
              onClick={() => {
                void reportRequest.mutate()
              }}
            >
              Retry
            </Button>
          }
        />
      )}

      <label className="mb-2 block font-medium" htmlFor="canvas-batch-quiz">
        Canvas quiz
      </label>
      <Select
        id="canvas-batch-quiz"
        className="mb-4 w-full md:max-w-xl"
        placeholder="Select a Classic Canvas quiz"
        value={selectedQuizId}
        onChange={setSelectedQuizId}
        loading={quizzesRequest.isLoading}
        showSearch
        notFoundContent={
          <Empty description="No quizzes found. They might not be published?" />
        }
        optionFilterProp="label"
        options={quizzes.map((quiz) => ({
          value: quiz.canvasQuizId,
          label: `${quiz.title} (${quiz.essayQuestions.length} essay ${
            quiz.essayQuestions.length === 1 ? 'question' : 'questions'
          })`,
        }))}
      />

      {selectedQuiz && (
        <>
          {blockingReason ? (
            <Alert
              className="mb-4"
              type="error"
              showIcon
              message="This quiz is not ready"
              description={blockingReason}
            />
          ) : (
            <Alert
              className="mb-4"
              type="success"
              showIcon
              message={`${selectedQuiz.detectedQuestions} of ${questionCount} HelpMe questions detected from Canvas.`}
            />
          )}

          <Space wrap>
            <Button
              type="primary"
              onClick={start}
              loading={starting}
              disabled={!canStart}
            >
              {isResuming ? 'Resume grading' : 'Grade and prefill SpeedGrader'}
            </Button>
            <Button
              icon={<ExportOutlined />}
              href={selectedQuiz.speedGraderUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open SpeedGrader
            </Button>
          </Space>
        </>
      )}

      {selectedQuiz &&
        runs.some((item) => item.canvasQuizId === selectedQuizId) && (
          <Select
            className="mt-4 w-full md:max-w-xl"
            aria-label="Grading run report"
            value={activeRunId}
            onChange={(runId) =>
              setSelectedRun({ quizId: selectedQuiz.canvasQuizId, runId })
            }
            options={runs
              .filter((item) => item.canvasQuizId === selectedQuizId)
              .map((item) => ({
                value: item.id,
                label: `Run ${item.id} · ${new Date(item.createdAt).toLocaleString()}`,
              }))}
          />
        )}

      {run && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Tag
              color={
                isRunning
                  ? 'processing'
                  : hasErrors
                    ? 'error'
                    : flags.length
                      ? 'warning'
                      : 'success'
              }
            >
              {isRunning
                ? 'Prefilling SpeedGrader'
                : isFailed
                  ? 'Prefill failed'
                  : hasErrors
                    ? 'Prefill finished with errors'
                    : flags.length
                      ? 'Prefill finished; review required'
                      : 'Prefill complete'}
            </Tag>
            <span className="text-gray-500" role="status" aria-live="polite">
              {counts
                ? `${counts.attempts} attempts · ${counts.posted} responses prefilled · ${counts.pending} pending · ${counts.skipped} skipped · ${counts.flagged} flagged · ${counts.errors} errors`
                : 'Loading progress…'}
            </span>
          </div>
          <Progress
            percent={percent}
            status={hasErrors ? 'exception' : isRunning ? 'active' : 'success'}
            aria-label="SpeedGrader prefill progress"
          />
          {run.error && (
            <Alert
              className="mt-4"
              type="error"
              showIcon
              message="Prefill failed"
              description={run.error}
            />
          )}
          {report.errors.length > 0 && (
            <Alert
              className="mt-4"
              type="error"
              showIcon
              message="Some items need attention before you post grades"
              description={
                <div>
                  <p>
                    Resolve each error below before posting grades. For an
                    unknown write outcome, check SpeedGrader before starting
                    another run; the write may already have succeeded.
                  </p>
                  <ul className="list-disc pl-5">
                    {report.errors.map((record) => (
                      <li
                        key={`${record.quizSubmissionId}-${record.attemptNumber}-${record.source}-${record.canvasQuestionId ?? ''}`}
                      >
                        Submission {record.quizSubmissionId}, attempt{' '}
                        {record.attemptNumber}
                        {record.source === 'question'
                          ? `, question ${record.position}`
                          : ''}
                        :{' '}
                        {record.error?.trim() ||
                          'Canvas prefill did not complete.'}
                      </li>
                    ))}
                  </ul>
                </div>
              }
            />
          )}
          {flags.length > 0 && (
            <Alert
              className="mt-4"
              type="warning"
              showIcon
              message="Some responses were flagged for review"
              description={
                <ul className="list-disc pl-5">
                  {flags.map((flag) => (
                    <li
                      key={`${flag.quizSubmissionId}-${flag.attemptNumber}-${flag.canvasQuestionId}`}
                    >
                      Submission {flag.quizSubmissionId}, attempt{' '}
                      {flag.attemptNumber}, question {flag.position}:{' '}
                      {flag.reason}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </div>
      )}
    </Card>
  )
}
