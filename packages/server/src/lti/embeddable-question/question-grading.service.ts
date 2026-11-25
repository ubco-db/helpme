import { Injectable } from '@nestjs/common';
import {
  questionGradingSettingsSchema,
  FINAL_GRADING_INSTRUCTION,
  MAX_GRADING_TEXT_LENGTH,
  type GradingEvaluation,
  type GradingSnapshot,
  type QuestionGradingSettings,
} from '@koh/common';
import { ChatbotApiService } from '../../chatbot/chatbot-api.service';
import { computeMechanicalFacts } from './deterministic-check-utils';
import {
  buildAppliedRequirements,
  buildGradingPromptInput,
  buildUserPrompt,
  effectiveScoreCap,
  validateGradePayload,
} from './grading-utils';

@Injectable()
export class QuestionGradingService {
  constructor(private readonly chatbotApiService: ChatbotApiService) {}

  async evaluate({
    courseId,
    questionText,
    gradingSettings,
    submission,
    gradingMode,
    finalInstruction,
  }: {
    courseId: number;
    questionText: string;
    gradingSettings: QuestionGradingSettings;
    submission: string;
    /**
     * Internal batch-only mode. Omitted is the practice path; 'final' replaces
     * the question's feedback instructions with the final instruction.
     */
    gradingMode?: 'final';
    /** Frozen batch instruction; omitted for practice grading. */
    finalInstruction?: string;
  }): Promise<GradingEvaluation> {
    if (submission.length > MAX_GRADING_TEXT_LENGTH) {
      throw new Error(
        `The answer exceeds the ${MAX_GRADING_TEXT_LENGTH}-character grading limit. Grade this answer manually in SpeedGrader; it was not truncated or sent to the model.`,
      );
    }
    // The one grading-path validation of the settings, before anything is
    // built or called; invalid settings fail before any chatbot call and
    // nothing is persisted.
    const parsed = questionGradingSettingsSchema.safeParse(gradingSettings);
    if (!parsed.success) {
      throw new Error('Question grading settings are invalid.');
    }
    const instruction =
      gradingMode === 'final'
        ? (finalInstruction ?? FINAL_GRADING_INSTRUCTION)
        : undefined;
    const snapshot: GradingSnapshot = structuredClone({
      questionText,
      gradingSettings: parsed.data,
      ...(gradingMode === 'final'
        ? {
            gradingMode: 'final' as const,
            instruction,
          }
        : {}),
    });
    const settings = snapshot.gradingSettings;
    const facts = computeMechanicalFacts(submission, settings.checks);
    const maxScore = settings.scoreScale.max;
    const appliedRequirements = buildAppliedRequirements(
      facts.triggeredChecks,
      facts.blank,
    );
    if (facts.blank) {
      // Blank responses bypass the AI entirely and score zero.
      return {
        score: 0,
        comment: '',
        appliedRequirements,
        maxScore,
        model: null,
        gradingSnapshot: snapshot,
        reasons: ['blank'],
        humanReviewReason: null,
      };
    }

    const effectiveCap = effectiveScoreCap(facts.triggeredChecks);

    // The chatbot service owns provider retries; HelpMe makes exactly one
    // call and validates the answer once. An invalid grade errors out and
    // the caller persists nothing.
    const response =
      await this.chatbotApiService.queryEmbeddableQuestionFeedback(
        buildUserPrompt(submission),
        courseId,
        buildGradingPromptInput(
          settings,
          effectiveCap,
          snapshot.questionText,
          facts,
          instruction ?? settings.feedbackInstructions,
        ),
      );
    const { score, comment, reasons, humanReviewReason } = validateGradePayload(
      response.answer,
      settings,
      effectiveCap,
    );
    return {
      score,
      comment,
      appliedRequirements,
      maxScore,
      model: response.model ?? null,
      gradingSnapshot: snapshot,
      reasons,
      humanReviewReason,
    };
  }
}
