'use client'

import { API } from '@/app/api'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { Alert, Button, Input, Typography, message } from 'antd'
import {
  useMemo,
  useRef,
  useState,
  use,
} from 'react'
import { FUNCTION_LABELS, LEVEL_LABELS } from './essayFeedbackConstants'
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
} from './essayFeedbackInteractions'
import {
  EssayBody,
  FeedbackCards,
  FeedbackSummary,
} from './EssayFeedbackViewer'
import type { EssayFeedbackResponse } from '@koh/common'
import './essay-feedback.css'

const { TextArea } = Input

const SAMPLE_ESSAY = `In modern consumer culture, brands do more than sell products - they sell identities.

Starbucks positions itself as a "third place" between home and work through deliberate language and store design.

This essay explores how corporate discourse constructs belonging and where that rhetoric breaks down when scrutinized against real labor practices.`

const SUPPORTED = ['.txt', '.md', '.doc', '.docx', '.pdf']

function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase()
  return SUPPORTED.some((ext) => lower.endsWith(ext))
}

export default function EssayFeedbackClient(props: {
  params: Promise<{ cid: string }>
}) {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const features = useCourseFeatures(courseId)

  const [essayText, setEssayText] = useState('')
  const [loadedFilename, setLoadedFilename] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<EssayFeedbackResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusErr, setStatusErr] = useState<string | null>(null)
  const [viewerState, setViewerState] = useState<ViewerState>(
    initialViewerState,
  )

  const dragDepth = useRef(0)

  const filtered = useMemo(() => {
    if (!feedback) return []
    return filterAnnotations(feedback.annotations, viewerState)
  }, [feedback, viewerState])

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
        setEssayText(text)
      } else {
        const res = await API.course.extractEssayText(courseId, file)
        setEssayText(res.essay_text.trim())
      }
      setLoadedFilename(file.name)
    } catch (err) {
      setLoadedFilename(null)
      setStatusErr(getErrorMessage(err))
    }
  }

  const onGenerate = async () => {
    const trimmed = essayText.trim()
    if (!trimmed) {
      message.error('Paste or upload essay text first.')
      return
    }
    setLoading(true)
    setStatusErr(null)
    try {
      const raw = await API.course.generateEssayFeedback(courseId, trimmed)
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
          description="Ask your instructor to enable it under Course settings → Chatbot · Assignment evaluation."
        />
      </div>
    )
  }

  if (feedback) {
    return (
      <div className="essay-fb-scope">
        <div className="viewer-root">
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
          <div className="layout">
            <div className="pdf-panel">
              <div className="paper">
                <EssayBody
                  paragraphs={feedback.essay.paragraphs}
                  annotations={filtered}
                  activeAnnotationId={viewerState.activeAnnotationId}
                  onActivate={(id) => setViewerState((s) => activate(s, id))}
                />
              </div>
            </div>
            <div className="feedback-panel">
              <div className="feedback-header">
                <Typography.Title level={5} className="!mb-3">
                  Feedback
                </Typography.Title>
                <div className="mb-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={`fb-tab ${viewerState.currentTab === 'annotations' ? 'is-active' : ''}`}
                    onClick={() =>
                      setViewerState((s) => switchTab(s, 'annotations'))
                    }
                  >
                    Annotations
                  </button>
                  <button
                    type="button"
                    className={`fb-tab ${viewerState.currentTab === 'summary' ? 'is-active' : ''}`}
                    onClick={() =>
                      setViewerState((s) => switchTab(s, 'summary'))
                    }
                  >
                    Summary
                  </button>
                </div>
                {viewerState.currentTab === 'annotations' && (
                  <>
                    <div className="feedback-filter-group mb-2">
                      <span className="feedback-filter-label">Function</span>
                      <div>
                        {(
                          ['all', 'content', 'interpersonal', 'organization'] as const
                        ).map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={`dim-pill ${viewerState.functionFilter === k ? 'is-active' : ''}`}
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
                    <div className="feedback-filter-group">
                      <span className="feedback-filter-label">Level</span>
                      <div>
                        {(
                          ['all', 'text', 'section', 'clause_word'] as const
                        ).map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={`dim-pill ${viewerState.levelFilter === k ? 'is-active' : ''}`}
                            onClick={() =>
                              setViewerState((s) =>
                                setLevelFilter(s, k as LevelFilter),
                              )
                            }
                          >
                            {k === 'all' ? 'All' : LEVEL_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="feedback-cards">
                {viewerState.currentTab === 'annotations' ? (
                  <FeedbackCards
                    annotations={filtered}
                    activeAnnotationId={viewerState.activeAnnotationId}
                    onActivate={(id) => setViewerState((s) => activate(s, id))}
                  />
                ) : (
                  <FeedbackSummary overall={feedback.overall_feedback} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="essay-fb-scope mx-auto max-w-3xl px-4 py-8">
      <Typography.Title level={3} className="!mb-2">
        Essay / report feedback
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-6">
        Upload a file or paste your Descriptive Report. The model configured for
        this course chatbot will return structured, formative feedback.
      </Typography.Paragraph>

      <div
        className={`dropzone ${dragOver ? 'is-dragover' : ''} ${loadedFilename ? 'is-loaded' : ''}`}
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
          className="dropzone__input"
          type="file"
          accept=".txt,.md,.doc,.docx,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void loadFile(file)
          }}
        />
        <div className="dropzone__title">Drop a file here or click to browse</div>
        <div className="dropzone__hint text-xs text-neutral-500">
          .txt, .md, .doc, .docx, .pdf — max 10 MB
        </div>
        {loadedFilename && (
          <div className="mt-3 text-sm font-semibold text-[#0c6b6e]">
            Loaded: {loadedFilename}
          </div>
        )}
      </div>

      <div className="mb-4">
        <Typography.Text strong>Or paste text</Typography.Text>
        <TextArea
          className="mt-2 font-serif"
          rows={12}
          value={essayText}
          onChange={(e) => setEssayText(e.target.value)}
          placeholder="Paste your essay here…"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setEssayText(SAMPLE_ESSAY)}>Load sample</Button>
        <Button type="primary" loading={loading} onClick={() => void onGenerate()}>
          Generate feedback
        </Button>
      </div>

      {statusErr && (
        <Alert type="error" message={statusErr} className="mb-4" showIcon />
      )}
    </div>
  )
}
