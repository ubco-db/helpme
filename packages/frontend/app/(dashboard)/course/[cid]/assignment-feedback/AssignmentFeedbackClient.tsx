'use client'

import { API } from '@/app/api'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { cn } from '@/app/utils/generalUtils'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { Alert, Button, Input, Typography, message } from 'antd'
import { useCallback, useMemo, useRef, useState, use } from 'react'
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
import type { EssayFeedbackResponse } from '@koh/common'

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
  const [feedback, setFeedback] = useState<EssayFeedbackResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusErr, setStatusErr] = useState<string | null>(null)
  const [viewerState, setViewerState] =
    useState<ViewerState>(initialViewerState)

  const dragDepth = useRef(0)

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

  const [dragOver, setDragOver] = useState(false)

  if (!features) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (!features.assignmentEvaluationEnabled) {
    return (
      <div className="p-6">
        <Alert
          type="warning"
          showIcon
          message="Assignment evaluation is not enabled for this course."
          description="Ask your instructor to enable it under Course Settings → Scroll down to Advanced -> LLED AI Assignment Feedback"
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
            <div className="mx-auto w-[min(720px,100%)] rounded-sm bg-[#fffff8] px-10 py-12 shadow-[0_2px_24px_rgba(0,0,0,0.13)]">
              <div className="font-serif text-[15px] leading-[1.85] text-stone-900">
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
                    'cursor-pointer rounded-lg border bg-transparent px-3.5 py-2 text-[13px] font-semibold text-stone-500',
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
                    'cursor-pointer rounded-lg border bg-transparent px-3.5 py-2 text-[13px] font-semibold text-stone-500',
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
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-400">
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
                            'm-0.5 inline-block cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold',
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
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-400">
                      Level
                    </span>
                    <div>
                      {(['all', 'text', 'section', 'clause_word'] as const).map(
                        (k) => (
                          <button
                            key={k}
                            type="button"
                            className={cn(
                              'm-0.5 inline-block cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold',
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
      <Typography.Paragraph type="secondary" className="!mb-6">
        Upload a file or paste your Descriptive Report. The model configured for
        this course chatbot will return structured, formative feedback.
      </Typography.Paragraph>

      <div
        className={cn(
          'relative mb-4 min-h-[160px] cursor-pointer rounded-[14px] border-2 border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center transition-[border-color,background] duration-150 ease-in-out',
          dragOver && 'bg-fb-teal-light border-teal-700',
          loadedFilename && 'border-fb-teal-mid bg-fb-teal-light border-solid',
        )}
        onDragEnter={(e) => {
          e.preventDefault()
          dragDepth.current += 1
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          dragDepth.current -= 1
          if (dragDepth.current <= 0) {
            dragDepth.current = 0
            setDragOver(false)
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          dragDepth.current = 0
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void loadFile(file)
        }}
      >
        <input
          className="absolute inset-0 cursor-pointer opacity-0"
          type="file"
          accept=".txt,.md,.doc,.docx,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void loadFile(file)
          }}
        />
        <div className="mb-1.5 text-base font-bold text-stone-500">
          Drop a file here or click to browse
        </div>
        <div className="text-xs text-stone-400">
          .txt, .md, .doc, .docx, .pdf — max 10 MB
        </div>
        {loadedFilename && (
          <div className="mt-3 text-sm font-semibold text-teal-700">
            Loaded: {loadedFilename}
          </div>
        )}
      </div>

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

      <div className="mb-4 flex flex-wrap gap-2">
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
