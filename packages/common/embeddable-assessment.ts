import { z } from 'zod'

const text = z.string().trim().max(15000)
const score = z.number().finite().min(0).max(100000)

export const scoreScaleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('range'),
    max: score.positive(),
    step: score.positive(),
  }),
  z.object({
    kind: z.literal('values'),
    values: z.array(score).min(2).max(100),
  }),
])

export type ScoreScale = z.infer<typeof scoreScaleSchema>

export function getMaxScore(scale: ScoreScale): number {
  return scale.kind === 'range' ? scale.max : Math.max(...scale.values)
}

export function isScoreAllowed(scale: ScoreScale, value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || value > getMaxScore(scale)) {
    return false
  }
  if (scale.kind === 'values') return scale.values.includes(value)
  const steps = value / scale.step
  return Math.abs(steps - Math.round(steps)) <= 1e-8
}

const scoreCap = score.nullable()

export const gradingCheckSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('minimum_sentences'),
    minimum: z.number().int().min(1).max(1000),
    scoreCap,
  }),
  z.object({
    kind: z.literal('maximum_sentences'),
    maximum: z.number().int().min(1).max(1000),
    scoreCap,
  }),
  z.object({
    kind: z.literal('capitalization'),
    term: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(
        /^[\p{L}\p{M}]+$/u,
        'Enter one word with the correct capitalization.',
      ),
    scoreCap,
  }),
])

export type GradingCheck = z.infer<typeof gradingCheckSchema>

export const questionGradingSettingsSchema = z
  .object({
    rubric: text.min(1, 'A question rubric is required.'),
    feedbackInstructions: text,
    scoreScale: scoreScaleSchema,
    checks: z.array(gradingCheckSchema).max(20),
    finalGradingInstructions: text,
  })
  .superRefine((settings, ctx) => {
    const scale = settings.scoreScale
    if (scale.kind === 'range') {
      if (
        scale.step > scale.max ||
        !Number.isSafeInteger(Math.round(scale.max / scale.step)) ||
        !isScoreAllowed(scale, scale.max)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['scoreScale', 'step'],
          message:
            'The maximum score must be a whole number of score increments.',
        })
      }
    } else if (
      !scale.values.includes(0) ||
      new Set(scale.values).size !== scale.values.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoreScale', 'values'],
        message: 'Allowed scores must be unique and include zero.',
      })
    }

    const checkKeys = new Set<string>()
    settings.checks.forEach((check, index) => {
      if (check.scoreCap !== null && !isScoreAllowed(scale, check.scoreCap)) {
        ctx.addIssue({
          code: 'custom',
          path: ['checks', index, 'scoreCap'],
          message: 'A score cap must be one of this question’s allowed scores.',
        })
      }
      const key =
        check.kind === 'capitalization'
          ? `${check.kind}:${check.term.toLocaleLowerCase('en')}`
          : check.kind
      if (checkKeys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['checks', index],
          message: 'This automatic check has already been added.',
        })
      }
      checkKeys.add(key)
    })
    const minimum = settings.checks.find(
      (check) => check.kind === 'minimum_sentences',
    )
    const maximum = settings.checks.find(
      (check) => check.kind === 'maximum_sentences',
    )
    if (
      minimum?.kind === 'minimum_sentences' &&
      maximum?.kind === 'maximum_sentences' &&
      minimum.minimum > maximum.maximum
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['checks'],
        message: 'The minimum sentence count cannot exceed the maximum.',
      })
    }
  })

export type QuestionGradingSettings = z.infer<
  typeof questionGradingSettingsSchema
>

export const upsertEmbeddableQuestionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  questionText: text.min(1),
  quizId: z.number().int().positive().nullable(),
  gradingSettings: questionGradingSettingsSchema,
})

export type UpsertEmbeddableQuestionParams = z.infer<
  typeof upsertEmbeddableQuestionSchema
>

export type EmbeddableQuestion = UpsertEmbeddableQuestionParams & {
  id: number
  courseId: number
  createdAt: string
}

export const upsertEmbeddableQuizSchema = z.object({
  title: z.string().trim().min(1).max(255),
  objective: text,
  background: text,
})

export type UpsertEmbeddableQuizParams = z.infer<
  typeof upsertEmbeddableQuizSchema
>

export type EmbeddableQuiz = UpsertEmbeddableQuizParams & {
  id: number
  courseId: number
  createdAt: string
}

export type QuizContext = Pick<
  EmbeddableQuiz,
  'id' | 'title' | 'objective' | 'background'
>

export type StudentEmbeddableQuestion = Pick<
  EmbeddableQuestion,
  'id' | 'courseId' | 'questionText'
>

export const embeddableQuestionFeedbackSchema = z.object({
  responseText: text.min(1, 'Enter an answer before requesting feedback.'),
})

export type EmbeddableQuestionFeedbackParams = z.infer<
  typeof embeddableQuestionFeedbackSchema
>

export interface EmbeddableQuestionFeedback {
  score: number
  comment: string
  maxScore: number
  appliedRequirements: string[]
}

export type GradingMode = 'feedback' | 'final'

export interface GradingSnapshot {
  version: 1
  questionText: string
  gradingSettings: QuestionGradingSettings
  quizContext: QuizContext | null
  mode: GradingMode
}

export type GradingEvaluation = EmbeddableQuestionFeedback & {
  model: string | null
  gradingSnapshot: GradingSnapshot
}

export const GRADING_PRESETS = {
  generic: {
    label: 'Start from scratch',
    gradingSettings: {
      rubric:
        'Describe what a complete, partial, and incorrect answer should contain.',
      feedbackInstructions:
        'Give concise, constructive feedback grounded in the rubric.',
      finalGradingInstructions:
        'Record the final grade in one or two neutral sentences. Do not address the student directly.',
      scoreScale: { kind: 'range', max: 10, step: 1 },
      checks: [],
    },
  },
  indigenous_reflection: {
    label: 'Indigenous reflection',
    gradingSettings: {
      rubric: `Grade a short Indigenous Studies reflection only against these criteria. Do not grade the student's opinion or attitude, or deduct marks for being brief or unambitious.

Award full marks when the answer addresses the question and is readable. Minor typos and proofreading issues do not cost marks.

An answer that does not address the question receives zero. Sensitive or racist content receives zero.

Deduct for grammar only when it is difficult to recover the meaning. Deduct for Aboriginal, Indian, or Native used as a general term for Indigenous peoples. Proper and legal names such as Indian Act and Osoyoos Indian Band are acceptable, as is Native American in a United States context.

Use the configured score scale consistently. Reserve intermediate scores for answers that clearly fall between the rubric levels.

Sentence requirements and capitalization are handled by the selected automatic checks. Do not deduct for them yourself.`,
      feedbackInstructions:
        'Give a short, constructive explanation. Minor proofreading comments must make clear that they did not cost marks. Do not repeat notes supplied by automatic checks.',
      finalGradingInstructions:
        'Record the final grade in one or two neutral sentences that summarize the main rubric reasons. Do not address the student directly.',
      scoreScale: { kind: 'range', max: 2, step: 0.5 },
      checks: [
        {
          kind: 'minimum_sentences',
          minimum: 3,
          scoreCap: 1,
        },
        {
          kind: 'maximum_sentences',
          maximum: 5,
          scoreCap: null,
        },
        {
          kind: 'capitalization',
          term: 'Indigenous',
          scoreCap: null,
        },
      ],
    },
  },
} satisfies Record<
  string,
  { label: string; gradingSettings: QuestionGradingSettings }
>

export type GradingPreset = keyof typeof GRADING_PRESETS

export function createGradingPreset(
  preset: GradingPreset,
): QuestionGradingSettings {
  return structuredClone(GRADING_PRESETS[preset].gradingSettings)
}
