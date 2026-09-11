import { Injectable } from '@nestjs/common';
import {
  questionGradingSettingsSchema,
  type GradingEvaluation,
  type GradingSnapshot,
  type QuestionGradingSettings,
} from '@koh/common';
import { ChatbotApiService } from '../../../chatbot/chatbot-api.service';
import { computeMechanicalFacts } from './deterministic-checks';
import {
  buildAppliedRequirements,
  buildSystemPrompt,
  buildUserPrompt,
  effectiveScoreCap,
  validateGradePayload,
} from './grading';

@Injectable()
export class QuestionGradingService {
  constructor(private readonly chatbotApiService: ChatbotApiService) {}

  async evaluate({
    courseId,
    questionText,
    gradingSettings,
    submission,
  }: {
    courseId: number;
    questionText: string;
    gradingSettings: QuestionGradingSettings;
    submission: string;
  }): Promise<GradingEvaluation> {
    // The one grading-path validation of the settings, before anything is
    // built or called; invalid settings fail before any chatbot call and
    // nothing is persisted.
    const parsed = questionGradingSettingsSchema.safeParse(gradingSettings);
    if (!parsed.success) {
      throw new Error('Question grading settings are invalid.');
    }
    const snapshot: GradingSnapshot = structuredClone({
      questionText,
      gradingSettings: parsed.data,
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
        needsHumanReview: false,
      };
    }

    const effectiveCap = effectiveScoreCap(facts.triggeredChecks);
    const systemPrompt = buildSystemPrompt(settings, effectiveCap);
    const userPrompt = buildUserPrompt(
      snapshot.questionText,
      submission,
      facts,
    );

    // The chatbot service owns provider retries; HelpMe makes exactly one
    // call and validates the answer once. An invalid grade errors out and
    // the caller persists nothing.
    const response = await this.chatbotApiService.queryFeedback(
      userPrompt,
      courseId,
      systemPrompt,
    );
    const { score, comment, reasons, needsHumanReview } = validateGradePayload(
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
      needsHumanReview,
    };
  }
}
