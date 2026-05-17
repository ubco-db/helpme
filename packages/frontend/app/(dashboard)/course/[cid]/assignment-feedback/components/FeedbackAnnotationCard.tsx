import { cn } from '@/app/utils/generalUtils'
import {
  FUNCTION_LABELS,
  LEVEL_LABELS,
  SEVERITY_LABELS,
} from '../assignmentFeedbackConstants'
import type { Annotation } from '../assignmentFeedbackTypes'
import SuggestedCourseMaterialBlock from './SuggestedCourseMaterialBlock'

export default function FeedbackAnnotationCard({
  annotation,
  isActive,
  onActivate,
}: {
  annotation: Annotation
  isActive: boolean
  onActivate: (id: number) => void
}) {
  const fnLabel = FUNCTION_LABELS[annotation.function]
  const levelLabel = LEVEL_LABELS[annotation.level]
  const sevLabel = SEVERITY_LABELS[annotation.severity]

  return (
    <article
      className={cn(
        'feedback-card',
        `feedback-card--severity-${annotation.severity}`,
        isActive && 'is-active',
      )}
      data-id={annotation.id}
      data-function={annotation.function}
      data-level={annotation.level}
      onClick={() => onActivate(annotation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate(annotation.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <header className="feedback-card__header">
        <span
          className={cn('feedback-card__pin', `pin-${annotation.severity}`)}
        >
          {annotation.id}
        </span>
        <span
          className={cn(
            'feedback-card__tag',
            'tag-function',
            `tag-${annotation.function}`,
          )}
        >
          {fnLabel}
        </span>
        <span className="feedback-card__tag tag-level">{levelLabel}</span>
        <span
          className={cn(
            'feedback-card__tag',
            'tag-severity',
            `tag-severity-${annotation.severity}`,
          )}
        >
          {sevLabel}
        </span>
      </header>
      <div className="feedback-card__issue">{annotation.issue_type}</div>
      {annotation.evidence?.quote ? (
        <blockquote className="feedback-card__quote">
          {annotation.evidence.quote}
        </blockquote>
      ) : null}
      {annotation.evidence?.reason ? (
        <p className="feedback-card__reason">
          <strong>Why it matters:</strong> {annotation.evidence.reason}
        </p>
      ) : null}
      <p className="feedback-card__text">
        <strong>Feedback:</strong> {annotation.feedback}
      </p>
      <p className="feedback-card__guidance">
        <strong>Revision guidance:</strong> {annotation.revision_guidance}
      </p>
      <SuggestedCourseMaterialBlock annotation={annotation} />
    </article>
  )
}
