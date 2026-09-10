/// <reference lib="es2022.intl" />

import type { GradingCheck } from '@koh/common';

const sentenceSegmenter = new Intl.Segmenter('en', {
  granularity: 'sentence',
});

// Intl.Segmenter splits title abbreviations and single initials that do not
// end a sentence here, so rejoin those segments.
const NONTERMINAL_END = /\b(?:dr|mr|mrs|ms|prof|jr|sr|st|vs|[a-z])\.$/i;

export function countSentences(text: string): number {
  const segments = [...sentenceSegmenter.segment(text)].map(
    (part) => part.segment,
  );
  const merged: string[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && NONTERMINAL_END.test(previous.trimEnd())) {
      merged[merged.length - 1] = previous + segment;
    } else {
      merged.push(segment);
    }
  }
  return merged.filter((segment) => segment.trim() !== '').length;
}

function escapedRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasIncorrectCapitalization(text: string, term: string): boolean {
  const matcher = new RegExp(
    `(?<!\\p{L})${escapedRegExp(term)}(?!\\p{L})`,
    'giu',
  );
  return [...text.matchAll(matcher)].some(([match]) => match !== term);
}

export interface MechanicalFacts {
  sentenceCount: number;
  blank: boolean;
  triggeredChecks: GradingCheck[];
}

export function computeMechanicalFacts(
  submission: string,
  checks: readonly GradingCheck[],
): MechanicalFacts {
  const sentenceCount = countSentences(submission);
  const blank = submission.trim().length === 0;
  const triggeredChecks = checks.filter((check) => {
    switch (check.kind) {
      case 'minimum_sentences':
        return sentenceCount < check.minimum;
      case 'maximum_sentences':
        return sentenceCount > check.maximum;
      case 'capitalization':
        return hasIncorrectCapitalization(submission, check.term);
      default:
        return false;
    }
  });

  return { sentenceCount, blank, triggeredChecks };
}
