import {
  FUNCTION_LABELS,
  LEVEL_LABELS,
  SEVERITY_LABELS,
} from './essayFeedbackConstants'
import type { Annotation, OverallFeedback, Paragraph } from './essayFeedbackTypes'
import { getSuggestedCourseMaterialSource } from './suggestedCourseMaterial'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildParagraphMap(paragraphs: Paragraph[]): Map<string, Paragraph> {
  const map = new Map<string, Paragraph>()
  for (const paragraph of paragraphs) {
    map.set(paragraph.id.toLowerCase(), paragraph)
  }
  return map
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function sliceParagraph(
  paragraph: Paragraph,
  paragraphAnnotations: Annotation[],
): string {
  const sorted = [...paragraphAnnotations].sort(
    (a, b) => a.char_start - b.char_start,
  )
  if (sorted.length === 0) {
    return `<p data-paragraph-id="${paragraph.id}">${escapeHtml(paragraph.text)}</p>`
  }

  let cursor = 0
  const parts: string[] = []

  for (const item of sorted) {
    const start = clamp(item.char_start, cursor, paragraph.text.length)
    const end = clamp(item.char_end, start, paragraph.text.length)
    if (start > cursor) {
      parts.push(escapeHtml(paragraph.text.slice(cursor, start)))
    }
    const slice = paragraph.text.slice(start, end)
    parts.push(
      `<span class="hl hl-${item.severity}" data-id="${item.id}">${escapeHtml(slice)}</span>`,
    )
    cursor = end
  }

  if (cursor < paragraph.text.length) {
    parts.push(escapeHtml(paragraph.text.slice(cursor)))
  }

  const pins = sorted
    .map(
      (item) =>
        `<button type="button" class="annotation-pin pin-${item.severity}" data-id="${item.id}" title="Annotation ${item.id}">${item.id}</button>`,
    )
    .join('')

  return `<p data-paragraph-id="${paragraph.id}">${parts.join('')}${pins}</p>`
}

export function renderEssayMarkup(
  paragraphs: Paragraph[],
  annotations: Annotation[],
): string {
  const paragraphMap = buildParagraphMap(paragraphs)
  const grouped = new Map<string, Annotation[]>()
  for (const item of annotations) {
    const key = item.paragraph_id.toLowerCase()
    if (!paragraphMap.has(key)) continue
    const list = grouped.get(key) ?? []
    list.push(item)
    grouped.set(key, list)
  }

  return paragraphs
    .map((paragraph) =>
      sliceParagraph(
        paragraph,
        grouped.get(paragraph.id.toLowerCase()) ?? [],
      ),
    )
    .join('')
}

function renderSuggestedCourseMaterialBlock(item: Annotation): string {
  const { label, url } = getSuggestedCourseMaterialSource(item)
  const safeLabel = escapeHtml(label)
  const fileLine =
    url && url.length > 0
      ? `<a class="feedback-card__material-file" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${safeLabel}</a>`
      : `<span class="feedback-card__material-file">${safeLabel}</span>`

  return `
  <aside class="feedback-card__suggested-material" aria-label="Suggested course material">
    <div class="feedback-card__material-title">Suggested course material</div>
    <p class="feedback-card__material-hint">Review this lesson before revising:</p>
    <p class="feedback-card__material-filewrap">${fileLine}</p>
  </aside>`
}

export function renderSidebarCards(annotations: Annotation[]): string {
  if (annotations.length === 0) {
    return `<div class="feedback-card feedback-card--empty"><div class="feedback-card__text">No feedback in the current filter.</div></div>`
  }

  return annotations
    .map((item) => {
      const fnLabel = FUNCTION_LABELS[item.function]
      const levelLabel = LEVEL_LABELS[item.level]
      const sevLabel = SEVERITY_LABELS[item.severity]

      return `
<article class="feedback-card feedback-card--severity-${item.severity}" data-id="${item.id}" data-function="${item.function}" data-level="${item.level}">
  <header class="feedback-card__header">
    <span class="feedback-card__pin pin-${item.severity}">${item.id}</span>
    <span class="feedback-card__tag tag-function tag-${item.function}">${fnLabel}</span>
    <span class="feedback-card__tag tag-level">${levelLabel}</span>
    <span class="feedback-card__tag tag-severity tag-severity-${item.severity}">${sevLabel}</span>
  </header>
  <div class="feedback-card__issue">${escapeHtml(item.issue_type)}</div>
  ${
    item.evidence?.quote
      ? `<blockquote class="feedback-card__quote">${escapeHtml(item.evidence.quote)}</blockquote>`
      : ''
  }
  ${
    item.evidence?.reason
      ? `<p class="feedback-card__reason"><strong>Why it matters:</strong> ${escapeHtml(item.evidence.reason)}</p>`
      : ''
  }
  <p class="feedback-card__text"><strong>Feedback:</strong> ${escapeHtml(item.feedback)}</p>
  <p class="feedback-card__guidance"><strong>Revision guidance:</strong> ${escapeHtml(item.revision_guidance)}</p>
  ${renderSuggestedCourseMaterialBlock(item)}
</article>`
    })
    .join('')
}

function renderList(title: string, items: string[]): string {
  if (items.length === 0) return ''
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<section class="summary-section"><h4>${title}</h4><ul>${lis}</ul></section>`
}

export function renderSummary(overall: OverallFeedback): string {
  const summary = overall.summary
    ? `<section class="summary-section"><h4>Overall Summary</h4><p>${escapeHtml(overall.summary)}</p></section>`
    : ''

  return `
    <div class="summary-card">
      ${summary}
      ${renderList('Priority Issues', overall.priority_issues)}
      ${renderList('Next Steps', overall.next_steps)}
      ${renderList('Reflection Questions', overall.reflection_questions)}
    </div>
  `
}
