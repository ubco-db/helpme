import { z } from 'zod'
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

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

// The single shared Zod validator owns every cross-field grading rule. It is
// enforced on the server through the class-validator constraint below and
// used directly by the question form on the frontend.
@ValidatorConstraint({ name: 'questionGradingSettings', async: false })
class QuestionGradingSettingsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return questionGradingSettingsSchema.safeParse(value).success
  }
  defaultMessage(args: ValidationArguments): string {
    const result = questionGradingSettingsSchema.safeParse(args.value)
    return result.success
      ? 'gradingSettings is invalid.'
      : (result.error.issues[0]?.message ?? 'gradingSettings is invalid.')
  }
}

export class UpsertEmbeddableQuestionParams {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(15000)
  questionText!: string

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  quizId!: number | null

  @Validate(QuestionGradingSettingsConstraint)
  gradingSettings!: QuestionGradingSettings
}

export type EmbeddableQuestion = UpsertEmbeddableQuestionParams & {
  id: number
  courseId: number
  createdAt: string
}

export class UpsertEmbeddableQuizParams {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string

  @IsString()
  @MaxLength(15000)
  objective!: string

  @IsString()
  @MaxLength(15000)
  background!: string
}

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

export class EmbeddableQuestionFeedbackParams {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15000)
  responseText!: string
}

export interface EmbeddableQuestionFeedback {
  score: number
  comment: string
  maxScore: number
  appliedRequirements: string[]
}

export interface GradingSnapshot {
  version: 1
  questionText: string
  gradingSettings: QuestionGradingSettings
  quizContext: QuizContext | null
}

export type GradingEvaluation = EmbeddableQuestionFeedback & {
  model: string | null
  gradingSnapshot: GradingSnapshot
  /** Free-form explanation strings reported by the model, plus host codes like blank. */
  reasons: string[]
  needsHumanReview: boolean
}

export const GRADING_PRESETS = {
  generic: {
    label: 'Start from scratch',
    gradingSettings: {
      rubric:
        'Describe what a complete, partial, and incorrect answer should contain.',
      feedbackInstructions:
        'Give concise, constructive feedback grounded in the rubric.',
      scoreScale: { kind: 'range', max: 10, step: 1 },
      checks: [],
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
