/** Contract aligned with LLED_bot_MVP src/shared/schema.ts */

export type FunctionDimension = 'content' | 'interpersonal' | 'organization';
export type LinguisticLevel = 'text' | 'section' | 'clause_word';
export type Severity = 'low' | 'medium' | 'high';

export interface Paragraph {
  id: string;
  text: string;
}

export interface Citation {
  type: 'rubric' | 'course_material';
  label: string;
  url: string | null;
}

export interface Evidence {
  quote: string;
  reason: string;
}

export interface Annotation {
  id: number;
  paragraph_id: string;
  char_start: number;
  char_end: number;
  function: FunctionDimension;
  level: LinguisticLevel;
  issue_type: string;
  severity: Severity;
  evidence: Evidence;
  feedback: string;
  revision_guidance: string;
  citations: Citation[];
}

export interface OverallFeedback {
  summary: string;
  priority_issues: string[];
  next_steps: string[];
  reflection_questions: string[];
}

export interface FeedbackResponse {
  submission_id: string | null;
  created_at: string | null;
  essay: { paragraphs: Paragraph[] };
  annotations: Annotation[];
  overall_feedback: OverallFeedback;
}
