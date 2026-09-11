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
          reasons: ['the answer missed the second required step'],
          needs_human_review: false,
        },
        makeSettings({ scoreScale, checks: [] }),
        null,
      ),
    ).toEqual({
      score,
      comment: 'Good answer.',
      reasons: ['the answer missed the second required step'],
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
    const prompt = buildUserPrompt(
      'Explain.',
      'One. Two. Three.',
      long,
      settings.checks,
    );
    expect(prompt).toContain('"maximum":2');
    expect(prompt).toContain('above the maximum of 2 sentences (actual: 3)');
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

  it('applies whatever score an arbitrary rubric dictates, with no host override', () => {
    // The host has no content policy of its own: a rubric that awards zero
    // without scholarly framing, and one that awards partial credit for it,
    // are both accepted and passed through unchanged.
    const settings = makeSettings({
      rubric:
        'Score 0 unless the answer cites a scholarly source; partial credit when framing is scholarly but citations are missing.',
      checks: [],
    });
    const zero = validateGradePayload(
      {
        score: 0,
        comment: 'No scholarly framing, so the rubric scores zero.',
        reasons: ['no scholarly framing'],
        needs_human_review: true,
      },
      settings,
      null,
    );
    expect(zero.score).toBe(0);
    expect(zero.needsHumanReview).toBe(true);
    expect(
      validateGradePayload(
        {
          score: 1,
          comment: 'Scholarly framing, but the citations are missing.',
          reasons: ['scholarly framing present', 'missing citations'],
          needs_human_review: false,
        },
        settings,
        null,
      ),
    ).toEqual({
      score: 1,
      comment: 'Scholarly framing, but the citations are missing.',
      reasons: ['scholarly framing present', 'missing citations'],
      needsHumanReview: false,
    });
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

  it('derives the effective cap as the lowest triggered cap', () => {
    const settings = makeSettings();
    expect(effectiveScoreCap(facts('example.', settings).triggeredChecks)).toBe(
      1,
    );
    expect(effectiveScoreCap([])).toBeNull();
  });

  it('builds the system prompt from the rubric, feedback instructions, score contract, and output shape', () => {
    const settings = makeSettings();
    const prompt = buildSystemPrompt(settings, 1);
    expect(prompt).toContain(
      'Award points for an accurate and supported answer.',
    );
    expect(prompt).toContain('Keep feedback concise and constructive.');
    expect(prompt).toContain('effective cap of 1');
    expect(prompt).toContain('needs_human_review');
  });

  it('includes the full triggered checks so the model can tell which term or rule fired', () => {
    const settings = makeSettings();
    const userPrompt = buildUserPrompt(
      'Explain the idea.',
      'example. answer here',
      facts('example.', settings),
      settings.checks,
    );
    expect(userPrompt).toContain('"automatic_checks_triggered"');
    expect(userPrompt).toContain('"term":"Example"');
    expect(userPrompt).toContain('"minimum":3');
  });

  it('reports a host-computed length verdict only when sentence checks exist', () => {
    const settings = makeSettings();
    expect(
      buildUserPrompt(
        'Explain the idea.',
        'Only one.',
        facts('Only one.', settings),
        settings.checks,
      ),
    ).toContain('below the minimum of 3 sentences (actual: 1)');
    expect(
      buildUserPrompt(
        'Explain the idea.',
        'Complete answer.',
        facts('Complete answer.', makeSettings({ checks: [] })),
        [],
      ),
    ).not.toContain('length_check');
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
