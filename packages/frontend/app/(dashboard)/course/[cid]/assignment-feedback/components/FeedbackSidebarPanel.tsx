import type { Annotation, OverallFeedback } from '../assignmentFeedbackTypes'
import FeedbackAnnotationCard from './FeedbackAnnotationCard'
import FeedbackSummaryView from './FeedbackSummaryView'

export default function FeedbackSidebarPanel({
  tab,
  annotations,
  overallFeedback,
  activeAnnotationId,
  onActivate,
}: {
  tab: 'annotations' | 'summary'
  annotations: Annotation[]
  overallFeedback: OverallFeedback
  activeAnnotationId: number | null
  onActivate: (id: number) => void
}) {
  if (tab === 'summary') {
    return <FeedbackSummaryView overall={overallFeedback} />
  }

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
      {annotations.map((annotation) => (
        <FeedbackAnnotationCard
          key={annotation.id}
          annotation={annotation}
          isActive={activeAnnotationId === annotation.id}
          onActivate={onActivate}
        />
      ))}
    </>
  )
}
