import { cn } from '@/app/utils/generalUtils'
import type { Annotation, Paragraph } from '../assignmentFeedbackTypes'
import { buildParagraphSegments } from '../assignmentFeedbackParagraphUtils'

export default function AssignmentParagraphView({
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
  const segments = buildParagraphSegments(paragraph, annotations)
  const sorted = [...annotations].sort((a, b) => {
    if (a.char_start === null && b.char_start === null) return 0
    if (a.char_start === null) return 1
    if (b.char_start === null) return -1
    return (a.char_start as number) - (b.char_start as number)
  })

  return (
    <p data-paragraph-id={paragraph.id}>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') {
          return <span key={`t-${index}`}>{segment.text}</span>
        }
        const { annotation, text } = segment
        const isActive = activeAnnotationId === annotation.id
        return (
          <span
            key={`h-${annotation.id}-${index}`}
            className={cn(
              'hl',
              `hl-${annotation.severity}`,
              isActive && 'is-active',
            )}
            data-id={annotation.id}
            role="button"
            tabIndex={0}
            onClick={() => onActivate(annotation.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onActivate(annotation.id)
              }
            }}
          >
            {text}
          </span>
        )
      })}
      {sorted.map((item) => {
        const isActive = activeAnnotationId === item.id
        return (
          <button
            key={`pin-${item.id}`}
            type="button"
            className={cn(
              'annotation-pin',
              `pin-${item.severity}`,
              isActive && 'is-active',
            )}
            data-id={item.id}
            title={`Annotation ${item.id}`}
            onClick={() => onActivate(item.id)}
          >
            {item.id}
          </button>
        )
      })}
    </p>
  )
}
