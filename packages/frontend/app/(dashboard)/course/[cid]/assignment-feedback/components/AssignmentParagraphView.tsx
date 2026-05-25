import { cn } from '@/app/utils/generalUtils'
import type { Annotation, Paragraph } from '../assignmentFeedbackTypes'
import { buildParagraphSegments } from '../assignmentFeedbackParagraphUtils'

/** Tailwind classes for highlight severity backgrounds + bottom borders */
const HL_SEVERITY: Record<string, string> = {
  low: 'bg-green-700/[0.12] border-b-2 border-green-700/50',
  medium: 'bg-amber-700/[0.12] border-b-2 border-amber-700/50',
  high: 'bg-rose-700/[0.12] border-b-2 border-rose-700/[0.55]',
}

/** Tailwind classes for annotation-pin severity backgrounds */
const PIN_BG: Record<string, string> = {
  low: 'bg-green-700',
  medium: 'bg-amber-700',
  high: 'bg-rose-700',
}

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
    <p data-paragraph-id={paragraph.id} className="relative mb-4">
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
              'cursor-pointer rounded-sm px-0.5 py-px transition-[background] duration-150',
              HL_SEVERITY[annotation.severity],
              isActive && 'outline-fb-teal-mid outline outline-2',
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
              'absolute -right-9 h-5 w-5 cursor-pointer rounded-full border-none text-xs font-bold text-white',
              PIN_BG[item.severity],
              isActive && 'scale-[1.08]',
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
