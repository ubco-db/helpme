import type { GradingCheck } from '@koh/common';
import { computeMechanicalFacts } from './deterministic-check-utils';

describe('computeMechanicalFacts', () => {
  describe('sentenceCount', () => {
    const cases: [string, string, number][] = [
      [
        'basic sentences',
        'First sentence. Second sentence! Third sentence?',
        3,
      ],
      [
        'abbreviations and initials',
        'Dr. Smith visited the U.B.C. campus e.g. yesterday. It was great.',
        2,
      ],
      ['decimals', 'The score was 3.5 out of 5.0 points. Good job.', 2],
      [
        'lowercase sentence beginnings',
        'i will review notes after class. then i will practice explaining the concepts',
        2,
      ],
      [
        'lowercase beginnings with abbreviations and initials',
        'dr. smith visited the U.B.C. campus e.g. yesterday. it was great.',
        2,
      ],
      [
        'abbreviation before a lowercase continuation',
        'I review notes, etc. before discussion. then I practice.',
        2,
      ],
      [
        'shorthand abbreviation before a lowercase continuation',
        'I compare concepts, ie. examples. then I explain them.',
        2,
      ],
      [
        'ellipsis before a lowercase continuation',
        'I pause... then continue my notes. then I discuss them.',
        2,
      ],
      [
        'numbered list items with lowercase beginnings',
        '1. take notes after reading.\n2. discuss questions with classmates.',
        2,
      ],
      ['quotes at boundaries', 'He said, "Hello!" Then he walked away.', 2],
      ['line breaks', 'First sentence\nSecond sentence\r\nThird sentence', 3],
      [
        'trailing text without punctuation',
        'This is a single sentence without a period at the end',
        1,
      ],
      ['empty text', '', 0],
      ['whitespace only', '   \n\t  ', 0],
    ];

    it.each(cases)('%s', (_label, text, expected) => {
      expect(computeMechanicalFacts(text, []).sentenceCount).toBe(expected);
    });
  });

  it('does not cap a two-sentence answer for lowercase sentence beginnings', () => {
    expect(
      computeMechanicalFacts(
        'i will review notes after class. then i will practice explaining the concepts',
        [{ kind: 'minimum_sentences', minimum: 2, scoreCap: 1 }],
      ).triggeredChecks,
    ).toEqual([]);
  });

  it('only computes checks selected for the question', () => {
    const checks: GradingCheck[] = [
      {
        kind: 'minimum_sentences',
        minimum: 3,
        scoreCap: 1,
      },
      {
        kind: 'capitalization',
        term: 'Example',
        scoreCap: null,
      },
    ];

    expect(computeMechanicalFacts('example.', checks).triggeredChecks).toEqual([
      checks[0],
      checks[1],
    ]);
    expect(
      computeMechanicalFacts('Example. Another sentence. Third sentence.', [
        checks[0],
      ]).triggeredChecks,
    ).toEqual([]);
  });

  it('reports blank as a fact and handles maximum sentence checks', () => {
    const checks: GradingCheck[] = [
      {
        kind: 'maximum_sentences',
        maximum: 1,
        scoreCap: null,
      },
    ];

    expect(computeMechanicalFacts('   ', checks)).toMatchObject({
      blank: true,
      triggeredChecks: [],
    });
    expect(computeMechanicalFacts('One. Two.', checks).triggeredChecks).toEqual(
      [checks[0]],
    );
    expect(computeMechanicalFacts('One.', checks).blank).toBe(false);
  });
});
