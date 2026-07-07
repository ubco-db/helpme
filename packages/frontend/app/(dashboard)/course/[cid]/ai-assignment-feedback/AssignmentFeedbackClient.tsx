'use client'

import { API } from '@/app/api'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { cn } from '@/app/utils/generalUtils'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Input, Typography, Upload, message } from 'antd'
import { useCallback, useMemo, useState, use } from 'react'
import { FUNCTION_LABELS, LEVEL_LABELS } from './assignmentFeedbackConstants'
import {
  activate,
  filterAnnotations,
  initialViewerState,
  setFunctionFilter,
  setLevelFilter,
  switchTab,
  type FunctionFilter,
  type LevelFilter,
  type ViewerState,
} from './assignmentFeedbackInteractions'
import AssignmentBodyView from './components/AssignmentBodyView'
import FeedbackSidebarPanel from './components/FeedbackSidebarPanel'
import type { FeedbackResponse } from './assignmentFeedbackTypes'

const { TextArea } = Input

const SAMPLE_ASSIGNMENT = `In modern consumer culture, brands do more than sell products - they sell identities.

Starbucks positions itself as a "third place" between home and work through deliberate language and store design.

This assignment explores how corporate discourse constructs belonging and where that rhetoric breaks down when scrutinized against real labor practices.`

const SUPPORTED = ['.txt', '.md', '.doc', '.docx', '.pdf']

function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase()
  return SUPPORTED.some((ext) => lower.endsWith(ext))
}

export default function AssignmentFeedbackClient(props: {
  params: Promise<{ cid: string }>
}) {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const features = useCourseFeatures(courseId)

  const [assignmentText, setAssignmentText] = useState('')
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusErr, setStatusErr] = useState<string | null>(null)
  const [viewerState, setViewerState] =
    useState<ViewerState>(initialViewerState)

  const filtered = useMemo(() => {
    if (!feedback) return []
    return filterAnnotations(feedback.annotations, viewerState)
  }, [feedback, viewerState])

  const handleActivate = useCallback((id: number) => {
    setViewerState((s) => activate(s, id))
  }, [])

  const loadFile = async (file: File) => {
    setStatusErr(null)
    if (!isSupportedFile(file.name)) {
      setStatusErr(
        'Unsupported file type. Use .txt, .md, .doc, .docx, or .pdf.',
      )
      setLoadedFilename(null)
      return
    }
    try {
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        const text = (await file.text()).trim()
        setAssignmentText(text)
      } else {
        const res = await API.aiAssignmentFeedback.extractAssignmentText(
          courseId,
          file,
        )
        setAssignmentText(res.essay_text.trim())
      }
      setLoadedFilename(file.name)
    } catch (err) {
      setLoadedFilename(null)
      setStatusErr(getErrorMessage(err))
    }
  }

  const onGenerate = async () => {
    const trimmed = assignmentText.trim()
    if (!trimmed) {
      message.error('Paste or upload assignment text first.')
      return
    }
    setLoading(true)
    setStatusErr(null)
    try {
      const raw = await API.aiAssignmentFeedback.generateAssignmentFeedback(
        courseId,
        trimmed,
      )
      setFeedback(raw)
      setViewerState(initialViewerState)
      message.success('Feedback generated.')
    } catch (err) {
      setStatusErr(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!features) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (!features.assignmentEvaluationEnabled) {
    return (
      <div className="p-6">
        <Alert
          type="warning"
          showIcon
          message="AI Assignment Evaluation is not enabled for this course."
          description="Ask your instructor to enable it under Course Settings → Scroll down to Advanced -> LLED AI Assignment Evaluation"
        />
      </div>
    )
  }

  if (feedback) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-stone-200">
        <div className="border-b border-neutral-200 bg-white px-4 py-3">
          <Button
            type="link"
            onClick={() => {
              setFeedback(null)
              setViewerState(initialViewerState)
            }}
          >
            ← Back to upload
          </Button>
        </div>
        <div className="grid min-h-[calc(100vh-120px)] grid-cols-1 lg:grid-cols-[1fr_min(460px,40vw)]">
          <div className="overflow-y-auto bg-[#c8c4bc] px-6 pb-12 pt-6">
            <div className="mx-auto w-full max-w-3xl rounded-sm bg-[#fffff8] px-10 py-12 shadow-lg">
              <div className="font-serif text-base leading-relaxed text-stone-900">
                <AssignmentBodyView
                  paragraphs={feedback.essay.paragraphs}
                  annotations={filtered}
                  activeAnnotationId={viewerState.activeAnnotationId}
                  onActivate={handleActivate}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col overflow-hidden border-l border-stone-300 bg-white">
            <div className="border-b border-stone-200 p-3.5">
              <Typography.Title level={5} className="!mb-3">
                Feedback
              </Typography.Title>
              <div className="mb-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-lg border bg-transparent px-3.5 py-2 text-sm font-semibold text-stone-500',
                    viewerState.currentTab === 'annotations'
                      ? 'bg-fb-teal-light border-fb-teal-mid text-teal-700'
                      : 'border-transparent',
                  )}
                  onClick={() =>
                    setViewerState((s) => switchTab(s, 'annotations'))
                  }
                >
                  Annotations
                </button>
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-lg border bg-transparent px-3.5 py-2 text-sm font-semibold text-stone-500',
                    viewerState.currentTab === 'summary'
                      ? 'bg-fb-teal-light border-fb-teal-mid text-teal-700'
                      : 'border-transparent',
                  )}
                  onClick={() => setViewerState((s) => switchTab(s, 'summary'))}
                >
                  Summary
                </button>
              </div>
              {viewerState.currentTab === 'annotations' && (
                <>
                  <div className="mb-2">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Function
                    </span>
                    <div>
                      {(
                        [
                          'all',
                          'content',
                          'interpersonal',
                          'organization',
                        ] as const
                      ).map((k) => (
                        <button
                          key={k}
                          type="button"
                          className={cn(
                            'm-0.5 inline-block cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold',
                            viewerState.functionFilter === k
                              ? 'bg-fb-teal-light border-teal-700 text-teal-700'
                              : 'border-stone-300 bg-stone-50 text-stone-500',
                          )}
                          onClick={() =>
                            setViewerState((s) =>
                              setFunctionFilter(s, k as FunctionFilter),
                            )
                          }
                        >
                          {k === 'all' ? 'All' : FUNCTION_LABELS[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Level
                    </span>
                    <div>
                      {(['all', 'text', 'section', 'clause_word'] as const).map(
                        (k) => (
                          <button
                            key={k}
                            type="button"
                            className={cn(
                              'm-0.5 inline-block cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold',
                              viewerState.levelFilter === k
                                ? 'bg-fb-teal-light border-teal-700 text-teal-700'
                                : 'border-stone-300 bg-stone-50 text-stone-500',
                            )}
                            onClick={() =>
                              setViewerState((s) =>
                                setLevelFilter(s, k as LevelFilter),
                              )
                            }
                          >
                            {k === 'all' ? 'All' : LEVEL_LABELS[k]}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
              <FeedbackSidebarPanel
                tab={viewerState.currentTab}
                annotations={filtered}
                overallFeedback={feedback.overall_feedback}
                activeAnnotationId={viewerState.activeAnnotationId}
                onActivate={handleActivate}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Typography.Title level={3} className="!mb-2">
        Assignment feedback
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="mb-1">
        Upload a file or paste your LLED Descriptive Report to get structured,
        formative feedback from the AI.
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" className="!mb-6">
        Uses UBC-hosted AI models and doesn&apos;t collect any data.
      </Typography.Paragraph>

      <Upload.Dragger
        className="mb-10 block max-h-40 md:mb-6"
        accept=".txt,.md,.doc,.docx,.pdf"
        multiple={false}
        maxCount={1}
        beforeUpload={(file) => {
          void loadFile(file)
          return false
        }}
        onRemove={() => {
          setLoadedFilename(null)
          setAssignmentText('')
        }}
        fileList={
          loadedFilename
            ? [
                {
                  uid: '-1',
                  name: loadedFilename,
                  status: 'done',
                },
              ]
            : []
        }
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag file to this area to upload
        </p>
        <p className="ant-upload-hint">
          Support for .txt, .md, .doc, .docx, .pdf - max 10 MB
        </p>
      </Upload.Dragger>

      <div className="mb-4">
        <Typography.Text strong>Or paste text</Typography.Text>
        <TextArea
          className="mt-2 font-serif"
          rows={12}
          value={assignmentText}
          onChange={(e) => setAssignmentText(e.target.value)}
          placeholder="Paste your assignment here…"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setAssignmentText(SAMPLE_ASSIGNMENT)}>
          Load sample
        </Button>
        <Button
          type="primary"
          loading={loading}
          onClick={() => void onGenerate()}
        >
          Generate feedback
        </Button>
        {loading && (
          <Typography.Paragraph type="secondary" className="m-0">
            This may take 30s-1min
          </Typography.Paragraph>
        )}
      </div>

      {statusErr && (
        <Alert
          type="error"
          message="Error generating feedback. Please try again."
          description={'Full Error Message: ' + statusErr}
          className="mb-4"
          showIcon
        />
      )}
    </div>
  )
}
