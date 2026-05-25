import type { Annotation, Paragraph } from '../assignmentFeedbackTypes'
import { groupAnnotationsByParagraph } from '../assignmentFeedbackParagraphUtils'
import AssignmentParagraphView from './AssignmentParagraphView'

export default function AssignmentBodyView({
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
  const grouped = groupAnnotationsByParagraph(paragraphs, annotations)

  return (
    <>
      {paragraphs.map((paragraph) => (
        <AssignmentParagraphView
          key={paragraph.id}
          paragraph={paragraph}
          annotations={grouped.get(paragraph.id.toLowerCase()) ?? []}
          activeAnnotationId={activeAnnotationId}
          onActivate={onActivate}
        />
      ))}
    </>
  )
}
