import type { Annotation } from '../assignmentFeedbackTypes'
import { getSuggestedCourseMaterialSource } from '../suggestedCourseMaterial'

export default function SuggestedCourseMaterialBlock({
  annotation,
}: {
  annotation: Annotation
}) {
  const { label, url } = getSuggestedCourseMaterialSource(annotation)

  return (
    <aside
      className="feedback-card__suggested-material"
      aria-label="Suggested course material"
    >
      <div className="feedback-card__material-title">Suggested course material</div>
      <p className="feedback-card__material-hint">
        Review this lesson before revising:
      </p>
      <p className="feedback-card__material-filewrap">
        {url && url.length > 0 ? (
          <a
            className="feedback-card__material-file"
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
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

