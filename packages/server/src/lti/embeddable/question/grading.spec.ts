import type { QuestionGradingSettings, ScoreScale } from '@koh/common';
import { computeMechanicalFacts } from './deterministic-checks';
import {
  BLANK_REQUIREMENT,
  buildAppliedRequirements,
  buildSystemPrompt,
  buildUserPrompt,
  effectiveScoreCap,
  GradingConstraintError,
  validateGradePayload,
} from './grading';

function makeSettings(
  overrides: Partial<QuestionGradingSettings> = {},
): QuestionGradingSettings {
  return {
    rubric: 'Award points for an accurate and supported answer.',
    feedbackInstructions: 'Keep feedback concise and constructive.',
    scoreScale: { kind: 'range', max: 2, step: 0.5 },
    checks: [
      { kind: 'minimum_sentences', minimum: 3, scoreCap: 1 },
      { kind: 'capitalization', term: 'Example', scoreCap: null },
    ],
    ...overrides,
  };
}

const facts = (submission: string, settings = makeSettings()) =>
  computeMechanicalFacts(submission, settings.checks);

describe('question grading contract', () => {
  it.each<ScoreScale>([
    { kind: 'range', max: 2, step: 0.5 },
    { kind: 'range', max: 10, step: 0.25 },
    { kind: 'range', max: 100, step: 1 },
    { kind: 'values', values: [0, 2, 7.5, 10] },
  ])('accepts scores from a question-owned scale: %j', (scoreScale) => {
    const score =
      scoreScale.kind === 'values' ? scoreScale.values[1] : scoreScale.step;
    expect(
      validateGradePayload(
        {
          score,
          comment: 'Good answer.',
          reasons: [
            'The response did not address the second required step of the rubric, so it lost that credit.',
          ],
          needs_human_review: false,
        },
        makeSettings({ scoreScale, checks: [] }),
        null,
      ),
    ).toEqual({
      score,
      comment: 'Good answer.',
      reasons: [
        'The response did not address the second required step of the rubric, so it lost that credit.',
      ],
      needsHumanReview: false,
    });
  });

  it('keeps only the lowest triggered cap for a capitalization-only cap', () => {
    const settings = makeSettings({
      checks: [
        { kind: 'capitalization', term: 'Indigenous', scoreCap: 1 },
        { kind: 'capitalization', term: 'Example', scoreCap: null },
      ],
    });
    expect(
      effectiveScoreCap(
        facts('the indigenous example.', settings).triggeredChecks,
      ),
    ).toBe(1);
    expect(() =>
      validateGradePayload(
        {
          score: 2,
          comment: 'Good answer.',
          reasons: ['off topic'],
          needs_human_review: false,
        },
        settings,
        1,
      ),
    ).toThrow(/effective cap of 1/);
    expect(
      validateGradePayload(
        {
          score: 1,
          comment: 'Good answer.',
          reasons: ['mostly complete'],
          needs_human_review: false,
        },
        settings,
        1,
      ).score,
    ).toBe(1);
  });

  it('applies the lowest cap for a maximum-length cap', () => {
    const settings = makeSettings({
      checks: [{ kind: 'maximum_sentences', maximum: 2, scoreCap: 1 }],
    });
    const long = facts('One. Two. Three.', settings);
    expect(
      long.triggeredChecks.some((check) => check.kind === 'maximum_sentences'),
    ).toBe(true);
    expect(effectiveScoreCap(long.triggeredChecks)).toBe(1);
    expect(() =>
      validateGradePayload(
        {
          score: 2,
          comment: 'Good.',
          reasons: ['complete'],
          needs_human_review: false,
        },
        settings,
        1,
      ),
    ).toThrow(/effective cap of 1/);
  });

  it('rejects malformed output and disallowed scores', () => {
    const settings = makeSettings({ checks: [] });
    const valid = {
      score: 1,
      comment: 'Good answer.',
      reasons: ['complete'],
      needs_human_review: false,
    };
    expect(() =>
      validateGradePayload({ ...valid, comment: ' ' }, settings, null),
    ).toThrow(GradingConstraintError);
    expect(() => validateGradePayload('not json', settings, null)).toThrow(
      GradingConstraintError,
    );
    // Otherwise-valid output whose score is off-grid (not a step on the scale).
    expect(() =>
      validateGradePayload({ ...valid, score: 1.25 }, settings, null),
    ).toThrow(/not allowed by the score contract/);
    expect(() =>
      validateGradePayload({ ...valid, reasons: [] }, settings, null),
    ).toThrow(GradingConstraintError);
    expect(() =>
      validateGradePayload(
        { ...valid, needs_human_review: undefined },
        settings,
        null,
      ),
    ).toThrow(GradingConstraintError);
    expect(() =>
      validateGradePayload({ ...valid, score: 11 }, settings, null),
    ).toThrow(/not allowed by the score contract/);
  });

  it('rejects scores above the effective cap instead of clamping', () => {
    const settings = makeSettings({ checks: [] });
    expect(() =>
      validateGradePayload(
        {
          score: 2,
          comment: 'Good answer.',
          reasons: ['off topic'],
          needs_human_review: false,
        },
        settings,
        1,
      ),
    ).toThrow(/effective cap of 1/);
    expect(
      validateGradePayload(
        {
          score: 1,
          comment: 'Good answer.',
          reasons: ['below the rubric level'],
          needs_human_review: false,
        },
        settings,
        1,
      ).score,
    ).toBe(1);
  });

  it('passes caller-supplied data into the prompts', () => {
    const settings = makeSettings();
    expect(buildSystemPrompt(settings, 1)).toContain(
      'Award points for an accurate and supported answer.',
    );
    const submission = 'One. Two. Three.';
    expect(
      buildUserPrompt(
        'Explain.',
        submission,
        facts(submission, settings),
        settings.checks,
      ),
    ).toContain(JSON.stringify(submission));
  });

  it('builds deterministic requirement notes separate from the model comment', () => {
    const settings = makeSettings();
    expect(
      buildAppliedRequirements(
        facts('example.', settings).triggeredChecks,
        false,
      ),
    ).toEqual([
      'Score capped at 1: the answer is below the 3-sentence minimum.',
      'Reminder only: uses of "Example" must be capitalized exactly like that; no score cap was applied.',
    ]);
    expect(buildAppliedRequirements([], false)).toEqual([]);
    expect(buildAppliedRequirements([], true)).toEqual([BLANK_REQUIREMENT]);
  });
});
