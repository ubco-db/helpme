import type React from 'react'
import {
  FUNCTION_LABELS,
  LEVEL_LABELS,
  SEVERITY_LABELS,
} from './essayFeedbackConstants'
import type { Annotation, OverallFeedback, Paragraph } from './essayFeedbackTypes'
import { getSuggestedCourseMaterialSource } from './suggestedCourseMaterial'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function groupedAnnotations(
  paragraphs: Paragraph[],
  annotations: Annotation[],
): Map<string, Annotation[]> {
  const paragraphIds = new Set(paragraphs.map((p) => p.id.toLowerCase()))
  const grouped = new Map<string, Annotation[]>()

  for (const item of annotations) {
    const key = item.paragraph_id.toLowerCase()
    if (!paragraphIds.has(key)) continue
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }

  return grouped
}

function ParagraphWithHighlights({
  paragraph,
  annotations,
  activeAnnotationId,
  onActivate,
}: {
  paragraph: Paragraph
  annotations: Annotation[]
  activeAnnotationId: number | null
  onActivate: (id: number) => void
}) {
  const sorted = [...annotations].sort((a, b) => a.char_start - b.char_start)
  let cursor = 0
  const parts: React.ReactNode[] = []

  for (const item of sorted) {
    const start = clamp(item.char_start, cursor, paragraph.text.length)
    const end = clamp(item.char_end, start, paragraph.text.length)
    if (start > cursor) {
      parts.push(paragraph.text.slice(cursor, start))
    }
    parts.push(
      <span
        key={`hl-${item.id}`}
        className={`hl hl-${item.severity} ${
          activeAnnotationId === item.id ? 'is-active' : ''
        }`}
        data-id={item.id}
        onClick={() => onActivate(item.id)}
      >
        {paragraph.text.slice(start, end)}
      </span>,
    )
    cursor = end
  }

  if (cursor < paragraph.text.length) {
    parts.push(paragraph.text.slice(cursor))
  }

  return (
    <p data-paragraph-id={paragraph.id}>
      {parts.length > 0 ? parts : paragraph.text}
      {sorted.map((item) => (
        <button
          key={`pin-${item.id}`}
          type="button"
          className={`annotation-pin pin-${item.severity} ${
            activeAnnotationId === item.id ? 'is-active' : ''
          }`}
          data-id={item.id}
          title={`Annotation ${item.id}`}
          onClick={() => onActivate(item.id)}
        >
          {item.id}
        </button>
      ))}
    </p>
  )
}

export function EssayBody({
  paragraphs,
  annotations,
  activeAnnotationId,
  onActivate,
}: {
  paragraphs: Paragraph[]
  annotations: Annotation[]
  activeAnnotationId: number | null
  onActivate: (id: number) => void
}) {
  const grouped = groupedAnnotations(paragraphs, annotations)

  return (
    <div className="essay-body">
      {paragraphs.map((paragraph) => (
        <ParagraphWithHighlights
          key={paragraph.id}
          paragraph={paragraph}
          annotations={grouped.get(paragraph.id.toLowerCase()) ?? []}
          activeAnnotationId={activeAnnotationId}
          onActivate={onActivate}
        />
      ))}
    </div>
  )
}

function SuggestedCourseMaterial({ item }: { item: Annotation }) {
  const { label, url } = getSuggestedCourseMaterialSource(item)

  return (
    <aside
      className="feedback-card__suggested-material"
      aria-label="Suggested course material"
    >
      <div className="feedback-card__material-title">
        Suggested course material
      </div>
      <p className="feedback-card__material-hint">
        Review this lesson before revising:
      </p>
      <p className="feedback-card__material-filewrap">
        {url ? (
          <a
            className="feedback-card__material-file"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {label}
          </a>
        ) : (
          <span className="feedback-card__material-file">{label}</span>
        )}
      </p>
    </aside>
  )
}

export function FeedbackCards({
  annotations,
  activeAnnotationId,
  onActivate,
}: {
  annotations: Annotation[]
  activeAnnotationId: number | null
  onActivate: (id: number) => void
}) {
  if (annotations.length === 0) {
    return (
      <div className="feedback-card feedback-card--empty">
        <div className="feedback-card__text">
          No feedback in the current filter.
        </div>
      </div>
    )
  }

  return (
    <>
      {annotations.map((item) => (
        <article
          key={item.id}
          className={`feedback-card feedback-card--severity-${item.severity} ${
            activeAnnotationId === item.id ? 'is-active' : ''
          }`}
          data-id={item.id}
          data-function={item.function}
          data-level={item.level}
          onClick={() => onActivate(item.id)}
        >
          <header className="feedback-card__header">
            <span className={`feedback-card__pin pin-${item.severity}`}>
              {item.id}
            </span>
            <span className={`feedback-card__tag tag-function tag-${item.function}`}>
              {FUNCTION_LABELS[item.function]}
            </span>
            <span className="feedback-card__tag tag-level">
              {LEVEL_LABELS[item.level]}
            </span>
            <span
              className={`feedback-card__tag tag-severity tag-severity-${item.severity}`}
            >
              {SEVERITY_LABELS[item.severity]}
            </span>
          </header>
          <div className="feedback-card__issue">{item.issue_type}</div>
          {item.evidence?.quote && (
            <blockquote className="feedback-card__quote">
              {item.evidence.quote}
            </blockquote>
          )}
          {item.evidence?.reason && (
            <p className="feedback-card__reason">
              <strong>Why it matters:</strong> {item.evidence.reason}
            </p>
          )}
          <p className="feedback-card__text">
            <strong>Feedback:</strong> {item.feedback}
          </p>
          <p className="feedback-card__guidance">
            <strong>Revision guidance:</strong> {item.revision_guidance}
          </p>
          <SuggestedCourseMaterial item={item} />
        </article>
      ))}
    </>
  )
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <section className="summary-section">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function FeedbackSummary({ overall }: { overall: OverallFeedback }) {
  return (
    <div className="summary-card">
      {overall.summary && (
        <section className="summary-section">
          <h4>Overall Summary</h4>
          <p>{overall.summary}</p>
        </section>
      )}
      <SummaryList title="Priority Issues" items={overall.priority_issues} />
      <SummaryList title="Next Steps" items={overall.next_steps} />
      <SummaryList
        title="Reflection Questions"
        items={overall.reflection_questions}
      />
    </div>
  )
}
