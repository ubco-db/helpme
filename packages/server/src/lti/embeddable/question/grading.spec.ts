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

  it('accepts a partial-credit math answer at a mid-scale score', () => {
    const settings = makeSettings({
      rubric:
        '2 points: both the setup and the simplification are right. 1 point: the setup is right but the simplification is wrong. 0 otherwise.',
      checks: [],
    });
    const validated = validateGradePayload(
      {
        score: 1,
        comment:
          'The setup correctly applied the distributive law, but the final simplification combined unlike terms; that step lost one point.',
        reasons: ['setup earned credit', 'simplification was wrong'],
        needs_human_review: false,
      },
      settings,
      null,
    );
    expect(validated).toMatchObject({ score: 1, needsHumanReview: false });
    expect(validated.reasons).toEqual([
      'setup earned credit',
      'simplification was wrong',
    ]);
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

  it('grades a sensitive-subject answer by the rubric without a host override', () => {
    const settings = makeSettings({
      rubric:
        'Score 0 when the answer discusses self-harm without a scholarly framing; otherwise grade the reflection normally.',
      checks: [],
    });
    const validated = validateGradePayload(
      {
        score: 1,
        comment:
          'The reflection is a scholarly discussion of a sensitive topic, so the rubric awards partial credit.',
        reasons: ['scholarly framing per rubric', 'missing citations'],
        needs_human_review: true,
      },
      settings,
      null,
    );
    // The host no longer forces sensitive answers to zero; the rubric decides.
    expect(validated.score).toBe(1);
    expect(validated.needsHumanReview).toBe(true);
    expect(
      validateGradePayload(
        {
          score: 0,
          comment: 'Sensitive content without scholarly framing scores zero.',
          reasons: ['no scholarly framing'],
          needs_human_review: true,
        },
        settings,
        null,
      ).score,
    ).toBe(0);
  });

  it('rejects malformed output and disallowed scores', () => {
    const settings = makeSettings({ checks: [] });
    expect(() =>
      validateGradePayload({ score: 1, comment: ' ' }, settings, null),
    ).toThrow(GradingConstraintError);
    expect(() => validateGradePayload('not json', settings, null)).toThrow(
      GradingConstraintError,
    );
    expect(() =>
      validateGradePayload(
        { score: 1.25, comment: 'Good answer.' },
        settings,
        null,
      ),
    ).toThrow(GradingConstraintError);
    expect(() =>
      validateGradePayload(
        {
          score: 1,
          comment: 'Good answer.',
          reasons: [],
          needs_human_review: false,
        },
        settings,
        null,
      ),
    ).toThrow(GradingConstraintError);
    expect(() =>
      validateGradePayload(
        {
          score: 1,
          comment: 'Good answer.',
          needs_human_review: false,
        },
        settings,
        null,
      ),
    ).toThrow(GradingConstraintError);
    expect(() =>
      validateGradePayload(
        {
          score: 11,
          comment: 'Good answer.',
          reasons: ['complete'],
          needs_human_review: false,
        },
        settings,
        null,
      ),
    ).toThrow(/not allowed by the score contract/);
  });

  it('accepts any non-empty reason strings without a fixed vocabulary', () => {
    const settings = makeSettings({ checks: [] });
    const reasons = [
      'the answer ignored the rubric’s evidence requirement',
      'one supporting detail was missing',
    ];
    expect(
      validateGradePayload(
        {
          score: 0.5,
          comment: 'Partial answer.',
          reasons,
          needs_human_review: false,
        },
        settings,
        null,
      ).reasons,
    ).toEqual(reasons);
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

  it('appends the rubric and feedback instructions to the fixed rules with no reason vocabulary', () => {
    const settings = makeSettings();
    const prompt = buildSystemPrompt(settings, 1);
    expect(prompt).toContain(
      'Award points for an accurate and supported answer.',
    );
    expect(prompt).toContain('Keep feedback concise and constructive.');
    expect(prompt).toContain('effective cap');
    expect(prompt).toContain('Never state or imply a numerical grade');
    expect(prompt).toContain('what earned and what lost credit');
    expect(prompt).not.toContain('## Reason codes');
    expect(prompt).not.toContain('meets_requirements');
    expect(prompt).not.toContain('Final grading');
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
