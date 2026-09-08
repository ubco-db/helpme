import {
  ALLOWED_INDIGENOUS_SCORES,
  GENERIC_DEFAULT_ALLOWED_SCORES,
  GENERIC_DEFAULT_REASON_CODES,
  GENERIC_DEFAULT_SYSTEM_PROMPT,
  type GradingProfile,
  INDG_DEFAULT_ALLOWED_SCORES,
  INDG_DEFAULT_REASON_CODES,
  INDG_DEFAULT_SYSTEM_PROMPT,
  INDIGENOUS_REASON_CODES,
} from '@koh/common';
import {
  buildSystemPrompt,
  postProcessFeedback,
  validateGradePayload,
  ValidatedGradePayload,
} from './grading';
import { MechanicalFacts } from './deterministic-checks';

type Contract = Pick<
  GradingProfile,
  'policyKind' | 'systemPrompt' | 'allowedScores' | 'reasonCodes'
>;

const indgProfile: Contract = {
  policyKind: 'indg-reflection',
  systemPrompt: 'INDG course system prompt.',
  allowedScores: [...ALLOWED_INDIGENOUS_SCORES],
  reasonCodes: [...INDIGENOUS_REASON_CODES],
};

const genericProfile: Contract = {
  policyKind: 'generic',
  systemPrompt: 'Generic course system prompt.',
  allowedScores: [0, 1, 2, 3],
  reasonCodes: ['meets_requirements', 'needs_review'],
};

const fullLengthFacts: MechanicalFacts = {
  sentenceCount: 3,
  requiredMinimum: 3,
  requiredMaximum: 5,
  belowMinimum: false,
  aboveMaximum: false,
  indigenousCapitalizationVariants: [],
};

const shortFacts: MechanicalFacts = {
  sentenceCount: 1,
  requiredMinimum: 3,
  requiredMaximum: 5,
  belowMinimum: true,
  aboveMaximum: false,
  indigenousCapitalizationVariants: [],
};

describe('Grading Profiles', () => {
  describe('buildSystemPrompt', () => {
    it('includes the shared INDG rules once for INDG defaults and not at all for generic defaults', () => {
      const indgPrompt = buildSystemPrompt(
        {
          policyKind: 'indg-reflection',
          systemPrompt: INDG_DEFAULT_SYSTEM_PROMPT,
          allowedScores: [...INDG_DEFAULT_ALLOWED_SCORES],
          reasonCodes: [...INDG_DEFAULT_REASON_CODES],
        },
        '',
      );
      const genericPrompt = buildSystemPrompt(
        {
          policyKind: 'generic',
          systemPrompt: GENERIC_DEFAULT_SYSTEM_PROMPT,
          allowedScores: [...GENERIC_DEFAULT_ALLOWED_SCORES],
          reasonCodes: [...GENERIC_DEFAULT_REASON_CODES],
        },
        '',
      );
      expect(indgPrompt.split('capitalize the I').length - 1).toBe(1);
      expect(genericPrompt).not.toContain('capitalize the I');
    });

    it('derives the output exemplar from a generic contract instead of hardcoding 2/meets_requirements', () => {
      const customPrompt = buildSystemPrompt(
        {
          policyKind: 'generic',
          systemPrompt: 'Custom course system prompt.',
          allowedScores: [0, 1],
          reasonCodes: ['custom_ok', 'custom_flag'],
        },
        '',
      );
      expect(customPrompt).toContain('"score":0');
      expect(customPrompt).toContain('"custom_ok"');
      expect(customPrompt).not.toContain('"score":2');
      expect(customPrompt).not.toContain('meets_requirements');
      const exemplar = JSON.parse(
        customPrompt.split('\n').find((line) => line.startsWith('{')) ?? '{}',
      );
      expect(
        validateGradePayload(exemplar, {
          policyKind: 'generic',
          systemPrompt: 'Custom course system prompt.',
          allowedScores: [0, 1],
          reasonCodes: ['custom_ok', 'custom_flag'],
        }).score,
      ).toBe(0);
    });
  });

  describe('validateGradePayload', () => {
    it('accepts a configured score and reason the INDG contract would reject', () => {
      const result = validateGradePayload(
        {
          score: 3,
          comment: 'Strong answer with room to grow.',
          reasons: ['needs_review'],
          needs_human_review: false,
        },
        genericProfile,
      );
      expect(result.score).toBe(3);
      expect(result.reasons).toEqual(['needs_review']);
      expect(result.needsHumanReview).toBe(false);
    });

    it('rejects scores and reasons outside the configured contract', () => {
      expect(() =>
        validateGradePayload(
          {
            score: 5,
            comment: 'Out of range score.',
            reasons: ['meets_requirements'],
            needs_human_review: false,
          },
          genericProfile,
        ),
      ).toThrow();
      expect(() =>
        validateGradePayload(
          {
            score: 2,
            comment: 'Unknown reason.',
            reasons: ['indigenous_capitalization'],
            needs_human_review: false,
          },
          genericProfile,
        ),
      ).toThrow();
    });

    it('keeps INDG full-mark exclusivity under the indg-reflection policy', () => {
      // Reminder-only: capitalization alone keeps full marks.
      expect(
        validateGradePayload(
          {
            score: 2,
            comment:
              'Remember to always capitalize the I in the word Indigenous in all of your writing.',
            reasons: ['indigenous_capitalization'],
            needs_human_review: false,
          },
          indgProfile,
        ).score,
      ).toBe(2);
      expect(() =>
        validateGradePayload(
          {
            score: 2,
            comment: 'Meets requirements.',
            reasons: ['meets_requirements', 'proofreading_note'],
            needs_human_review: false,
          },
          indgProfile,
        ),
      ).toThrow();
    });

    it('allows capitalization with proofreading_note at full marks', () => {
      const result = validateGradePayload(
        {
          score: 2,
          comment: 'Reminder plus a trivial slip.',
          reasons: ['indigenous_capitalization', 'proofreading_note'],
          needs_human_review: false,
        },
        indgProfile,
      );
      expect(result.score).toBe(2);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          'indigenous_capitalization',
          'proofreading_note',
        ]),
      );
    });

    it('keeps capitalization alongside an independent deduction', () => {
      const result = validateGradePayload(
        {
          score: 1,
          comment: 'Grammar and capitalization.',
          reasons: ['indigenous_capitalization', 'unreadable'],
          needs_human_review: false,
        },
        indgProfile,
      );
      expect(result.score).toBe(1);
      expect(result.reasons).toContain('indigenous_capitalization');
      expect(result.reasons).toContain('unreadable');
    });

    it('rejects a low score carried only by the reminder', () => {
      expect(() =>
        validateGradePayload(
          {
            score: 1,
            comment: 'Reminder only.',
            reasons: ['indigenous_capitalization'],
            needs_human_review: false,
          },
          indgProfile,
        ),
      ).toThrow();
      expect(() =>
        validateGradePayload(
          {
            score: 1,
            comment: 'Reminder plus note.',
            reasons: ['indigenous_capitalization', 'proofreading_note'],
            needs_human_review: false,
          },
          indgProfile,
        ),
      ).toThrow();
    });

    it('still rejects proofreading combined with a real deduction', () => {
      expect(() =>
        validateGradePayload(
          {
            score: 1,
            comment: 'Note plus deduction.',
            reasons: ['proofreading_note', 'unreadable'],
            needs_human_review: false,
          },
          indgProfile,
        ),
      ).toThrow();
    });

    it('emits an effective INDG prompt where the reminder-only rule takes precedence over stale saved wording', () => {
      const staleProfile: Contract = {
        ...indgProfile,
        systemPrompt:
          'Old wording: Lowercase indigenous → 1, indigenous_capitalization.',
      };
      const prompt = buildSystemPrompt(staleProfile, '');
      expect(prompt).toContain('reminder-only and never reduces the score');
      expect(prompt).toContain('takes precedence over any older saved prompt');
      // The built contract still validates the reminder-only outcome.
      const parsed = JSON.parse(
        '{"score": 2, "comment": "string", "reasons": ["meets_requirements"], "needs_human_review": false}',
      );
      expect(
        validateGradePayload(
          { ...parsed, reasons: ['indigenous_capitalization'] },
          indgProfile,
        ).score,
      ).toBe(2);
    });

    it('forces human review for terminology flags under the indg-reflection policy', () => {
      const result = validateGradePayload(
        {
          score: 1,
          comment: 'Check terminology.',
          reasons: ['terminology_review'],
          needs_human_review: false,
        },
        indgProfile,
      );
      expect(result.needsHumanReview).toBe(true);
    });
  });

  describe('postProcessFeedback', () => {
    it('passes a generic result through unchanged even when short', () => {
      const validated: ValidatedGradePayload = {
        score: 3,
        comment: 'Strong answer.',
        reasons: ['needs_review'],
        needsHumanReview: false,
      };
      const result = postProcessFeedback(validated, shortFacts, genericProfile);
      expect(result).toEqual(validated);
    });

    it('caps a short INDG answer at 1 with the fixed sentence comment', () => {
      const validated: ValidatedGradePayload = {
        score: 2,
        comment: 'Answer addressed the question.',
        reasons: ['meets_requirements'],
        needsHumanReview: false,
      };
      const result = postProcessFeedback(validated, shortFacts, indgProfile);
      expect(result.score).toBe(1);
      expect(result.reasons).toContain('too_short');
      expect(result.comment).toContain(
        'This answer does not meet the sentence requirements noted in the question.',
      );
    });

    it('leaves a full-length INDG answer untouched', () => {
      const validated: ValidatedGradePayload = {
        score: 2,
        comment: 'Answer addressed the question.',
        reasons: ['meets_requirements'],
        needsHumanReview: false,
      };
      const result = postProcessFeedback(
        validated,
        fullLengthFacts,
        indgProfile,
      );
      expect(result).toEqual(validated);
    });

    it('retains the capitalization reminder when the length cap applies', () => {
      const reminder: ValidatedGradePayload = {
        score: 2,
        comment:
          'Remember to always capitalize the I in the word Indigenous in all of your writing.',
        reasons: ['indigenous_capitalization'],
        needsHumanReview: false,
      };
      const capped = postProcessFeedback(reminder, shortFacts, indgProfile);
      expect(capped.score).toBe(1);
      expect(capped.reasons).toEqual(
        expect.arrayContaining(['too_short', 'indigenous_capitalization']),
      );
      expect(capped.comment).toContain('Remember to always capitalize');
    });

    it('strips the proofreading marker but keeps the reminder when short', () => {
      const both: ValidatedGradePayload = {
        score: 2,
        comment: 'Reminder plus slip.',
        reasons: ['indigenous_capitalization', 'proofreading_note'],
        needsHumanReview: false,
      };
      const capped = postProcessFeedback(both, shortFacts, indgProfile);
      expect(capped.score).toBe(1);
      expect(capped.reasons).toContain('too_short');
      expect(capped.reasons).toContain('indigenous_capitalization');
      expect(capped.reasons).not.toContain('proofreading_note');
    });
  });
});
