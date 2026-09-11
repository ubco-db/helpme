import { Injectable } from '@nestjs/common';
import {
  getMaxScore,
  type GradingEvaluation,
  type GradingSnapshot,
  type QuestionGradingSettings,
  type QuizContext,
} from '@koh/common';
import { ChatbotApiService } from '../../../chatbot/chatbot-api.service';
import { computeMechanicalFacts } from './deterministic-checks';
import {
  buildAppliedRequirements,
  buildSystemPrompt,
  buildUserPrompt,
  effectiveScoreCap,
  validateGradePayload,
  validateGradingSettings,
} from './grading';

@Injectable()
export class QuestionGradingService {
  constructor(private readonly chatbotApiService: ChatbotApiService) {}

  async evaluate({
    courseId,
    questionText,
    gradingSettings,
    quizContext = null,
    submission,
  }: {
    courseId: number;
    questionText: string;
    gradingSettings: QuestionGradingSettings;
    quizContext?: QuizContext | null;
    submission: string;
  }): Promise<GradingEvaluation> {
    const snapshot: GradingSnapshot = structuredClone({
      version: 1,
      questionText,
      gradingSettings: validateGradingSettings(gradingSettings),
      quizContext,
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
      effectiveCap,
      snapshot.quizContext,
    );
    const userPrompt = buildUserPrompt(
      snapshot.questionText,
      submission,
      facts,
      settings.checks,
    );

    // The chatbot service owns provider retries; HelpMe makes exactly one
    // call and validates the answer once. An invalid grade errors out and
    // the caller persists nothing.
    const response = await this.chatbotApiService.queryChatbotForCourse(
      userPrompt,
      courseId,
      'feedback',
      { systemPrompt },
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
