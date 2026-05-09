/** JSON schema for OpenAI structured outputs — aligned with LLED_bot_MVP openaiClient.ts */

const citationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'label', 'url'],
  properties: {
    type: { enum: ['rubric', 'course_material'] },
    label: { type: 'string' },
    url: { type: ['string', 'null'] },
  },
} as const;

const evidenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['quote', 'reason'],
  properties: {
    quote: { type: 'string' },
    reason: { type: 'string' },
  },
} as const;

const annotationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'paragraph_id',
    'char_start',
    'char_end',
    'function',
    'level',
    'issue_type',
    'severity',
    'evidence',
    'feedback',
    'revision_guidance',
    'citations',
  ],
  properties: {
    id: { type: 'integer' },
    paragraph_id: { type: 'string' },
    char_start: { type: 'integer', minimum: 0 },
    char_end: { type: 'integer', minimum: 0 },
    function: { enum: ['content', 'interpersonal', 'organization'] },
    level: { enum: ['text', 'section', 'clause_word'] },
    issue_type: { type: 'string' },
    severity: { enum: ['low', 'medium', 'high'] },
    evidence: evidenceSchema,
    feedback: { type: 'string' },
    revision_guidance: { type: 'string' },
    citations: { type: 'array', items: citationSchema },
  },
} as const;

const overallFeedbackSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'priority_issues', 'next_steps', 'reflection_questions'],
  properties: {
    summary: { type: 'string' },
    priority_issues: { type: 'array', items: { type: 'string' } },
    next_steps: { type: 'array', items: { type: 'string' } },
    reflection_questions: { type: 'array', items: { type: 'string' } },
  },
} as const;

const paragraphSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'text'],
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
  },
} as const;

export const feedbackJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'submission_id',
    'created_at',
    'essay',
    'annotations',
    'overall_feedback',
  ],
  properties: {
    submission_id: { type: ['string', 'null'] },
    created_at: { type: ['string', 'null'] },
    essay: {
      type: 'object',
      additionalProperties: false,
      required: ['paragraphs'],
      properties: {
        paragraphs: { type: 'array', items: paragraphSchema },
      },
    },
    annotations: { type: 'array', items: annotationSchema },
    overall_feedback: overallFeedbackSchema,
  },
} as const;
