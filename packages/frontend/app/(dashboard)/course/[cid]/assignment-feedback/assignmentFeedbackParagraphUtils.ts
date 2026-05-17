import type { Annotation, Paragraph } from './assignmentFeedbackTypes'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function buildParagraphMap(
  paragraphs: Paragraph[],
): Map<string, Paragraph> {
  const map = new Map<string, Paragraph>()
  for (const paragraph of paragraphs) {
    map.set(paragraph.id.toLowerCase(), paragraph)
  }
  return map
}

export function groupAnnotationsByParagraph(
  paragraphs: Paragraph[],
  annotations: Annotation[],
): Map<string, Annotation[]> {
  const paragraphMap = buildParagraphMap(paragraphs)
  const grouped = new Map<string, Annotation[]>()
  for (const item of annotations) {
    const key = item.paragraph_id.toLowerCase()
    if (!paragraphMap.has(key)) continue
    const list = grouped.get(key) ?? []
    list.push(item)
    grouped.set(key, list)
  }
  return grouped
}

export type ParagraphSegment =
  | { kind: 'text'; text: string }
  | { kind: 'highlight'; text: string; annotation: Annotation }

export function buildParagraphSegments(
  paragraph: Paragraph,
  paragraphAnnotations: Annotation[],
): ParagraphSegment[] {
  const sorted = [...paragraphAnnotations].sort(
    (a, b) => a.char_start - b.char_start,
  )
  if (sorted.length === 0) {
    return [{ kind: 'text', text: paragraph.text }]
  }

  const segments: ParagraphSegment[] = []
  let cursor = 0

  for (const item of sorted) {
    const start = clamp(item.char_start, cursor, paragraph.text.length)
    const end = clamp(item.char_end, start, paragraph.text.length)
    if (start > cursor) {
      segments.push({
        kind: 'text',
        text: paragraph.text.slice(cursor, start),
      })
    }
    segments.push({
      kind: 'highlight',
      text: paragraph.text.slice(start, end),
      annotation: item,
    })
    cursor = end
  }

  if (cursor < paragraph.text.length) {
    segments.push({ kind: 'text', text: paragraph.text.slice(cursor) })
  }

  return segments
}
