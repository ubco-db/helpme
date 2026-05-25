import { cn } from '@/app/utils/generalUtils'
import {
  FUNCTION_LABELS,
  LEVEL_LABELS,
  SEVERITY_LABELS,
} from '../assignmentFeedbackConstants'
import type { Annotation } from '../assignmentFeedbackTypes'
import SuggestedCourseMaterialBlock from './SuggestedCourseMaterialBlock'

/** Tailwind classes for annotation-pin severity backgrounds */
const PIN_BG: Record<string, string> = {
  low: 'bg-green-700',
  medium: 'bg-amber-700',
  high: 'bg-rose-700',
}

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
        'cursor-pointer rounded-xl border border-stone-300 bg-stone-50 p-3.5',
        isActive && 'outline-fb-teal-mid outline outline-2',
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
      <header className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold text-white',
            PIN_BG[annotation.severity],
          )}
        >
          {annotation.id}
        </span>
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px]">
          {fnLabel}
        </span>
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px]">
          {levelLabel}
        </span>
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px]">
          {sevLabel}
        </span>
      </header>
      <div>{annotation.issue_type}</div>
      {annotation.evidence?.exact_quote ? (
        <blockquote className="border-fb-teal-mid my-2 border-l-[3px] pl-3 italic">
          {annotation.evidence.exact_quote}
        </blockquote>
      ) : null}
      {annotation.evidence?.reason ? (
        <p>
          <strong>Why it matters:</strong> {annotation.evidence.reason}
        </p>
      ) : null}
      <p>
        <strong>Feedback:</strong> {annotation.feedback}
      </p>
      <p>
        <strong>Revision guidance:</strong> {annotation.revision_guidance}
      </p>
      <SuggestedCourseMaterialBlock annotation={annotation} />
    </article>
  )
}
