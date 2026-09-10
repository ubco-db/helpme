import {
  getMaxScore,
  type GradingEvaluation,
  type GradingMode,
  type GradingSnapshot,
  type QuestionGradingSettings,
  type QuizContext,
} from '@koh/common';
import { Injectable } from '@nestjs/common';
import { ChatbotApiService } from '../../../chatbot/chatbot-api.service';
import { computeMechanicalFacts } from './deterministic-checks';
import {
  buildAppliedRequirements,
  buildCorrectionPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  effectiveScoreCap,
  GradingConstraintError,
  GradingFailedError,
  postProcessFeedback,
  validateGradePayload,
  validateGradingSettings,
} from './grading';

// Initial call plus up to three corrective retries.
const MAX_GRADING_ATTEMPTS = 4;

@Injectable()
export class QuestionGradingService {
  constructor(private readonly chatbotApiService: ChatbotApiService) {}

  async evaluate({
    courseId,
    questionText,
    gradingSettings,
    quizContext = null,
    submission,
    mode = 'feedback',
  }: {
    courseId: number;
    questionText: string;
    gradingSettings: QuestionGradingSettings;
    quizContext?: QuizContext | null;
    submission: string;
    mode?: GradingMode;
  }): Promise<GradingEvaluation> {
    const snapshot: GradingSnapshot = structuredClone({
      version: 1,
      questionText,
      gradingSettings: validateGradingSettings(gradingSettings),
      quizContext,
      mode,
    });
    const settings = snapshot.gradingSettings;
    const facts = computeMechanicalFacts(submission, settings.checks);
    const maxScore = getMaxScore(settings.scoreScale);
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
        needsHumanReview: false,
      };
    }

    const effectiveCap = effectiveScoreCap(facts.triggeredChecks);
    const systemPrompt = buildSystemPrompt(
      settings,
      mode,
      effectiveCap,
      snapshot.quizContext,
    );
    const baseUserPrompt = buildUserPrompt(
      snapshot.questionText,
      submission,
      facts,
      settings.checks,
    );
    let userPrompt = baseUserPrompt;

    for (let attempt = 0; attempt < MAX_GRADING_ATTEMPTS; attempt++) {
      // Transport/auth failures propagate immediately; only model-output
      // validation failures are retried.
      const response = await this.chatbotApiService.queryChatbotForCourse(
        userPrompt,
        courseId,
        'feedback',
        { systemPrompt },
      );
      try {
        const { score, comment, reasons, needsHumanReview } =
          postProcessFeedback(
            validateGradePayload(response.answer, settings, effectiveCap),
            facts,
          );
        return {
          score,
          comment,
          appliedRequirements,
          maxScore,
          model: response.model ?? null,
          gradingSnapshot: snapshot,
          reasons,
          needsHumanReview,
        };
      } catch (error) {
        if (!(error instanceof GradingConstraintError)) {
          throw error;
        }
        userPrompt = buildCorrectionPrompt(
          baseUserPrompt,
          response.answer,
          error,
        );
      }
    }

    throw new GradingFailedError(
      'The grading model did not return a valid grade within the allowed retries; no feedback was saved.',
    );
  }
}
