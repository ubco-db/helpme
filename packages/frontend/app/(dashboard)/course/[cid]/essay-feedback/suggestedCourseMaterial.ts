/**
 * Suggested course material for essay feedback annotations.
 * Prefer API-provided course_material citations from the chatbot service.
 */

import type { Annotation, Citation } from './essayFeedbackTypes'

const DEFAULT_MATERIAL_LABEL = 'Course materials uploaded to this course'

export interface SuggestedCourseMaterialSource {
  label: string
  url: string | null
}

function firstCourseMaterialCitation(
  citations: Citation[] | undefined,
): Citation | undefined {
  if (!citations?.length) return undefined
  return citations.find((c) => c.type === 'course_material')
}

/**
 * Resolves the suggested material label and optional URL for one annotation.
 */
export function getSuggestedCourseMaterialSource(
  annotation: Annotation,
): SuggestedCourseMaterialSource {
  const fromApi = firstCourseMaterialCitation(annotation.citations)
  if (fromApi?.label?.trim()) {
    return {
      label: fromApi.label,
      url:
        fromApi.url !== undefined &&
        fromApi.url !== null &&
        String(fromApi.url).length > 0
          ? fromApi.url
          : null,
    }
  }

  return { label: DEFAULT_MATERIAL_LABEL, url: null }
}
