'use client'

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Popconfirm,
  Progress,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { ExportOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AutograderRunStatus } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const POLL_INTERVAL_MS = 2000

function manualPostingMessage(lmsPlatform: string) {
  return (
    <>
      <p>
        <Link
          href="https://community.instructure.com/en/kb/articles/660845-how-do-i-select-a-grade-posting-policy-for-an-assignment-in-the-gradebook"
          target="_blank"
          rel="noopener noreferrer"
        >
          Set this assignment&apos;s Grade Posting Policy to &quot;Manual&quot;
        </Link>{' '}
        before running the autograder. In {lmsPlatform}, open Grades, find the
        assignment column, open its three-dot menu, choose Grade Posting Policy,
        set it to Manually, and save.
      </p>
      <p>
        Manual posting is required because HelpMe writes AI grades into
        SpeedGrader before you review them. With automatic posting, students
        could see the AI grade and receive notifications before you have checked
        it. HelpMe never posts or releases grades itself.
      </p>
    </>
  )
}

export default function AutograderPage({
  courseId,
  lmsPlatform,
}: {
  courseId: number
  lmsPlatform: string
}): ReactElement {
  const pathname = usePathname()
  const [selectedQuizId, setSelectedQuizId] = useState<number>()
  const [selectedRunId, setSelectedRunId] = useState<number>()
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [startedRunId, setStartedRunId] = useState<number>()
  const [regradeSubmissions, setRegradeSubmissions] = useState(false)
  const [includePostedGrades, setIncludePostedGrades] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [lastReportAt, setLastReportAt] = useState<number>()

  // The quiz list is expensive (it reads Canvas questions and resource links),
  // so it is fetched once. The runs and report are polled while work is active.
  const quizzesRequest = useSWRImmutable(`autograder/quizzes/${courseId}`, () =>
    API.lti.autograder.getQuizzes(courseId),
  )
  const runsRequest = useSWR(
    `autograder/runs/${courseId}`,
    () => API.lti.autograder.getRuns(courseId),
    {
      revalidateOnFocus: false,
      refreshInterval: (runs) =>
        runs?.some((run) => run.status === AutograderRunStatus.Running)
          ? POLL_INTERVAL_MS
          : 0,
    },
  )

  const quizzes = quizzesRequest.data ?? []
  const mutateRuns = runsRequest.mutate
  const runs = useMemo(() => runsRequest.data ?? [], [runsRequest.data])
  const selectedQuiz = quizzes.find(
    (quiz) => quiz.canvasQuizId === selectedQuizId,
  )
  const quizRuns = useMemo(
    () => runs.filter((run) => run.canvasQuizId === selectedQuizId),
    [runs, selectedQuizId],
  )
  const latestRun = quizRuns[0]
  // Trust an explicitly selected run even before the polled run list contains
  // it. Previously the list had to catch up first, which left the report request
  // without a key right after starting a run.
  const activeRunId = selectedRunId ?? latestRun?.id

  const reportRequest = useSWR(
    activeRunId
      ? (['autograder/report', courseId, activeRunId] as const)
      : null,
    ([, courseId, runId]) => API.lti.autograder.getReport(courseId, runId),
    {
      revalidateOnFocus: false,
      refreshInterval: (report) =>
        report?.run.status === AutograderRunStatus.Running
          ? POLL_INTERVAL_MS
          : 0,
      // SWR deep-compares data by default, so an effect keyed on the report
      // object would not re-run when a poll returns identical data. onSuccess
      // fires for every successful revalidation, which keeps the countdown
      // accurate even between attempts. Update `now` too so the first report
      // after mount cannot produce a stale, oversized countdown.
      onSuccess: () => {
        const at = Date.now()
        setLastReportAt(at)
        setNow(at)
      },
    },
  )
  const report =
    reportRequest.data?.run.id === activeRunId ? reportRequest.data : undefined
  const run = report?.run
  const reportRunning = run?.status === AutograderRunStatus.Running
  const isFailed = run?.status === AutograderRunStatus.Failed
  const isCancelled = run?.status === AutograderRunStatus.Cancelled
  const questionCount = selectedQuiz?.essayQuestions.length ?? 0

  // The list and the report are polled independently. If the list still says a
  // run is Running but the report for that same run has already finished, trust
  // the report. Otherwise the UI shows a stale "Resume grading" button and
  // clicking it starts a second run because the server no longer has an active
  // run to resume.
  const listedActiveRun = quizRuns.find(
    (item) => item.status === AutograderRunStatus.Running,
  )
  const activeRun =
    listedActiveRun && report?.run.id === listedActiveRun.id && !reportRunning
      ? undefined
      : listedActiveRun
  // A run is active if either source knows about it. `startedRunId` records the
  // run started or resumed from this page mount, so its own progress does not
  // look like a stale run discovered on page load.
  const serverActiveRunId =
    activeRun?.id ?? (reportRunning ? run?.id : undefined)
  const serverRunActive = serverActiveRunId !== undefined
  const isOwnActiveRun = serverRunActive && serverActiveRunId === startedRunId
  const isStaleActiveRun = serverRunActive && !isOwnActiveRun

  useEffect(() => {
    if (!reportRunning) {
      return
    }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [reportRunning])

  // When the selected report finishes, refresh the run list so the Start/Resume
  // label and the stale-run notice match the report without waiting for the
  // next list poll. Depend on primitives so polling updates do not re-run this.
  const reportRunId = report?.run.id
  const reportFinished = reportRunId !== undefined && !reportRunning
  useEffect(() => {
    if (reportFinished) {
      void mutateRuns()
    }
  }, [reportRunId, reportFinished, mutateRuns])

  const manualPostingReason =
    selectedQuiz && !selectedQuiz.postManually
      ? manualPostingMessage(lmsPlatform)
      : null
  const blockingReason = !selectedQuiz
    ? null
    : (selectedQuiz.blockingReason ??
      manualPostingReason ??
      (questionCount === 0
        ? `This ${lmsPlatform} quiz has no essay questions.`
        : null))
  const quizReady =
    selectedQuiz != null &&
    selectedQuiz.postManually &&
    selectedQuiz.assignmentId !== null &&
    selectedQuiz.speedGraderUrl !== null &&
    questionCount > 0 &&
    selectedQuiz.blockingReason == null
  const canStart =
    selectedQuiz != null && !isOwnActiveRun && (isStaleActiveRun || quizReady)

  // Clamp so a stale `now` can never show more than one poll interval.
  const nextUpdateIn =
    reportRunning && report
      ? Math.min(
          Math.ceil(POLL_INTERVAL_MS / 1000),
          Math.max(
            0,
            Math.ceil(((lastReportAt ?? now) + POLL_INTERVAL_MS - now) / 1000),
          ),
        )
      : null

  const start = async () => {
    if (!selectedQuiz) {
      return
    }
    setStarting(true)
    try {
      const started = await API.lti.autograder.startRun(courseId, {
        canvasQuizId: selectedQuiz.canvasQuizId,
        regradeSubmissions,
        includePostedGrades,
        // A stale run is resumed explicitly so the server rejects it if it
        // finished instead of silently creating a second run.
        ...(isStaleActiveRun && serverActiveRunId !== undefined
          ? { resumeRunId: serverActiveRunId }
          : {}),
      })
      setStartedRunId(started.id)
      setSelectedRunId(started.id)
      message.success(
        started.resumed
          ? 'Resumed the grading run that was already in progress.'
          : 'Grading started. HelpMe is prefilling SpeedGrader.',
      )
      // Keep the button busy until the run list reflects the new run; otherwise
      // it can flicker back to an enabled "Start grading" for a moment.
      await runsRequest.mutate()
    } catch (error) {
      message.error(`Failed to start grading: ${getErrorMessage(error)}`)
      // The run may have finished between the list poll and this click.
      void runsRequest.mutate()
      void reportRequest.mutate()
    } finally {
      setStarting(false)
    }
  }

  const cancel = async () => {
    if (serverActiveRunId === undefined) {
      return
    }
    setCancelling(true)
    try {
      const cancelled = await API.lti.autograder.cancelRun(
        courseId,
        serverActiveRunId,
      )
      const counts = cancelled.counts
      message.success(
        `Stopped the grading run. ${counts.written} ${
          counts.written === 1 ? 'response was' : 'responses were'
        } prefilled and ${counts.pending} ${
          counts.pending === 1 ? 'question was' : 'questions were'
        } not graded.`,
      )
      setStartedRunId(undefined)
      void runsRequest.mutate()
      void reportRequest.mutate()
    } catch (error) {
      message.error(`Failed to cancel grading: ${getErrorMessage(error)}`)
    } finally {
      setCancelling(false)
    }
  }

  const counts = run?.counts
  const hasErrors = isFailed || (counts?.errors ?? 0) > 0
  const flags = report?.flags ?? []
  const total = counts?.questions ?? 0
  const done = (counts?.written ?? 0) + (counts?.skipped ?? 0)
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  const loadError = quizzesRequest.error ?? runsRequest.error

  return (
    <Card
      title="Autograder"
      className="min-w-0"
      classNames={{ body: 'p-3 md:p-6' }}
    >
      <p className="mb-2 text-gray-600">
        HelpMe grades the essay questions that contain a HelpMe embeddable
        question and prefills the scores and comments into {lmsPlatform}{' '}
        SpeedGrader.
      </p>
      <ol className="mb-4 list-inside list-decimal text-gray-600">
        <li>Select a published Classic {lmsPlatform} quiz.</li>
        <li>
          HelpMe detects its{' '}
          <Link
            className="underline"
            href={`${pathname}?tab=embeddable_questions`}
          >
            Embeddable Questions
          </Link>{' '}
          and uses the same grading prompts you provided to prefill the
          SpeedGrader.
        </li>
        <li>You review and post grades in {lmsPlatform}.</li>
        <li>
          Make sure to review all submission comments to check for any "HUMAN
          REVIEW REQUIRED" comments (delete them afterwards).
        </li>
      </ol>
      <Alert
        className="mb-4"
        type="warning"
        showIcon
        message="Do not edit the quiz or post grades while the autograder is running."
      />
      {loadError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message={`Failed to load ${lmsPlatform} quizzes`}
          description={getErrorMessage(loadError)}
          action={
            <Button
              icon={<ReloadOutlined />}
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
              icon={<ReloadOutlined />}
              onClick={() => {
                void reportRequest.mutate()
              }}
            >
              Retry
            </Button>
          }
        />
      )}

      <label className="mb-2 block font-medium" htmlFor="autograder-quiz">
        {lmsPlatform} quiz
      </label>
      <Select
        id="autograder-quiz"
        className="mb-4 w-full md:max-w-xl"
        placeholder={`Select a Classic ${lmsPlatform} quiz`}
        value={selectedQuizId}
        onChange={(quizId) => {
          setSelectedQuizId(quizId)
          setSelectedRunId(undefined)
        }}
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
          })${quiz.blockingReason ? ' — not ready' : ''}`,
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
              message={`${selectedQuiz.detectedQuestions} of ${questionCount} HelpMe questions detected from ${lmsPlatform}.`}
            />
          )}

          {isStaleActiveRun && (
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message="A grading run is in progress for this quiz"
              description="It was not started from this page, so it may have been interrupted. Resume it to continue grading, or cancel it to stop. Its grading options were frozen when it started."
            />
          )}

          <div className="mb-4 rounded border border-gray-200 p-3">
            <div className="mb-1 font-medium">Grading options</div>
            <Checkbox
              checked={regradeSubmissions}
              disabled={serverRunActive}
              onChange={(event) => {
                setRegradeSubmissions(event.target.checked)
                if (!event.target.checked) {
                  setIncludePostedGrades(false)
                }
              }}
            >
              Regrade submissions
            </Checkbox>
            <p className="ml-6 mt-1 text-sm text-gray-500">
              Grade questions that already have a {lmsPlatform} score or
              comment.{' '}
              <b>
                <i>All</i> existing scores/comments are overwritten.
              </b>
            </p>
            <Checkbox
              className="mt-2"
              checked={includePostedGrades}
              disabled={!regradeSubmissions || serverRunActive}
              onChange={(event) => setIncludePostedGrades(event.target.checked)}
            >
              Include submissions with posted grades
            </Checkbox>
            <p className="ml-6 mt-1 text-sm text-gray-500">
              Also regrade attempts whose grades were already posted.{' '}
              {lmsPlatform} may send grade-change notifications to students.
            </p>
          </div>

          <Space wrap>
            <Tooltip
              title={
                isOwnActiveRun
                  ? 'A grading run is already in progress.'
                  : canStart
                    ? undefined
                    : 'Resolve the quiz readiness message before starting.'
              }
            >
              <Button
                type="primary"
                onClick={() => {
                  void start()
                }}
                loading={starting}
                disabled={!canStart}
              >
                {isOwnActiveRun
                  ? 'Grading…'
                  : isStaleActiveRun
                    ? 'Resume grading'
                    : 'Start grading'}
              </Button>
            </Tooltip>
            {serverRunActive && (
              <Popconfirm
                title="Stop this grading run?"
                description="Responses already prefilled stay in SpeedGrader. The remaining submissions will not be graded."
                okText="Stop grading"
                cancelText="Keep grading"
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  void cancel()
                }}
              >
                <Button danger icon={<StopOutlined />} loading={cancelling}>
                  Cancel run
                </Button>
              </Popconfirm>
            )}
            {selectedQuiz.speedGraderUrl ? (
              <Button
                icon={<ExportOutlined />}
                href={selectedQuiz.speedGraderUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open SpeedGrader
              </Button>
            ) : (
              <Button icon={<ExportOutlined />} disabled>
                Open SpeedGrader
              </Button>
            )}
          </Space>
        </>
      )}

      {selectedQuiz && quizRuns.length > 0 && (
        <Select
          className="mt-4 w-full md:max-w-xl"
          aria-label="Grading run report"
          value={activeRunId}
          onChange={(runId) => setSelectedRunId(runId)}
          options={quizRuns.map((item) => ({
            value: item.id,
            label: `Run ${item.id} · ${new Date(item.createdAt).toLocaleString()}${
              item.regradeSubmissions ? ' · regrade' : ''
            }`,
          }))}
        />
      )}

      {run && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Tag
              color={
                reportRunning
                  ? 'processing'
                  : isCancelled
                    ? 'red'
                    : isFailed
                      ? 'error'
                      : hasErrors
                        ? 'error'
                        : flags.length
                          ? 'warning'
                          : 'success'
              }
            >
              {reportRunning
                ? 'Prefilling SpeedGrader'
                : isCancelled
                  ? 'Cancelled'
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
                ? `${counts.attempts} attempts · ${counts.written} responses prefilled · ${counts.pending} pending · ${counts.skipped} skipped · ${counts.flagged} flagged · ${counts.errors} errors`
                : 'Loading progress…'}
            </span>
            {reportRunning && (
              <span className="text-gray-500" role="status" aria-live="polite">
                {nextUpdateIn && nextUpdateIn > 0
                  ? `Next update in ${nextUpdateIn}s`
                  : 'Updating…'}
              </span>
            )}
          </div>
          <Progress
            percent={percent}
            status={
              hasErrors ? 'exception' : reportRunning ? 'active' : 'success'
            }
            aria-label="SpeedGrader prefill progress"
          />
          {run.regradeSubmissions && (
            <p className="mt-2 text-sm text-gray-500">
              This run regrades existing scores and comments
              {run.includePostedGrades
                ? ', including submissions whose grades were already posted.'
                : '.'}
            </p>
          )}
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
                          `${lmsPlatform} prefill did not complete.`}
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
