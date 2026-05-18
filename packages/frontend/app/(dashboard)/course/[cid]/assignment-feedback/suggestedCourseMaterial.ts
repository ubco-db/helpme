/**
 * Suggested course material for assignment feedback annotations — aligned with LLED_bot_MVP behaviour.
 * Prefer API-provided course_material citations; otherwise use function × level fallback filenames.
 */

import type { Annotation, Citation, FunctionDimension, LinguisticLevel } from './assignmentFeedbackTypes'

/** Exact filenames from curriculum mapping (do not alter). */
const FALLBACK_BY_FUNCTION_AND_LEVEL: Record<
  FunctionDimension,
  Record<LinguisticLevel, string>
> = {
  content: {
    text: 'LLED200 Academic Writing_ Representing Content V.5 2025.docx',
    section: 'LLED200 Week 4 Definitions 2025.pptx',
    clause_word:
      'LLED200 Academic Writing_ Representing Content V.5 2025.docx',
  },
  interpersonal: {
    text: 'Unit 3  Interpersonal Positioning & Citation v.03 July 9 2015.docx',
    section:
      'Unit 3  Interpersonal Positioning & Citation v.03 July 9 2015.docx',
    clause_word:
      'Hedging & Boosting in Research Writing in the Field of Artificial Intelligence.docx',
  },
  organization: {
    text: 'Description_Model_Holocene Epoch_LLED 200_outline & clause analysis.docx',
    section: 'Unit 6 Logic and Cohesion TEACHERS NOTES  v.03 July 9.docx',
    clause_word:
      'LLED200 Task Theme-New Organization in Academic Writing.docx',
  },
}

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

  const label =
    FALLBACK_BY_FUNCTION_AND_LEVEL[annotation.function][annotation.level]
  return { label, url: null }
}
