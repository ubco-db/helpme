import { Logger } from '@nestjs/common';
import { diff_match_patch } from 'diff-match-patch';
import type { AssignmentFeedbackParagraph } from '@koh/common';

const logger = new Logger('TextMatcher');
const dmp = new diff_match_patch();
dmp.Match_Threshold = 0.5;
dmp.Match_Distance = 1000;

export interface MatchResult {
  paragraph_id: string;
  char_start: number;
  char_end: number;
}

interface MatchLoc {
  char_start: number;
  char_end: number;
}

function findMatchesInText(text: string, quote: string): MatchLoc[] {
  const matches: MatchLoc[] = [];

  // Exact match
  let index = text.indexOf(quote);
  if (index !== -1) {
    while (index !== -1) {
      matches.push({ char_start: index, char_end: index + quote.length });
      index = text.indexOf(quote, index + 1);
    }
    return matches;
  }

  // Fuzzy match via bookends (start 32 chars and end 32 chars of the quote - since match_main only works with max 32 characters)
  const startPattern = quote.length <= 32 ? quote : quote.slice(0, 32);
  const endPattern = quote.length <= 32 ? quote : quote.slice(-32);

  const startIndex = dmp.match_main(text, startPattern, 0);

  if (startIndex !== -1) {
    const expectedEndLoc = Math.max(
      0,
      startIndex + quote.length - endPattern.length,
    );
    const endMatchIndex = dmp.match_main(text, endPattern, expectedEndLoc);

    if (endMatchIndex !== -1) {
      logger.warn(
        `Exact match failed for quote. Fuzzy matched bookends at start: ${startIndex}, end: ${endMatchIndex}`,
      );
      const endIndex = endMatchIndex + endPattern.length;
      matches.push({ char_start: startIndex, char_end: endIndex });
      return matches;
    }
  }

  return [];
}

function findMatchesInEssay(
  paragraphs: AssignmentFeedbackParagraph[],
  quote: string,
): MatchResult[] {
  const allMatches: MatchResult[] = [];
  for (const p of paragraphs) {
    const locs = findMatchesInText(p.text, quote);
    for (const loc of locs) {
      allMatches.push({
        paragraph_id: p.id,
        char_start: loc.char_start,
        char_end: loc.char_end,
      });
    }
  }
  return allMatches;
}

export function findQuoteInEssay(
  paragraphs: AssignmentFeedbackParagraph[],
  targetParagraphId: string,
  exactQuote: string,
  contextBefore?: string,
  contextAfter?: string,
): MatchResult | null {
  const targetP = paragraphs.find(
    (p) => p.id.toLowerCase() === targetParagraphId.toLowerCase(),
  );

  // 1. Try designated paragraph
  let matches: MatchResult[] = [];
  if (targetP) {
    const locs = findMatchesInText(targetP.text, exactQuote);
    matches = locs.map((l) => ({
      paragraph_id: targetP.id,
      char_start: l.char_start,
      char_end: l.char_end,
    }));
  }

  if (matches.length === 1) return matches[0];

  if (matches.length === 0) {
    // 2. Try whole text
    matches = findMatchesInEssay(paragraphs, exactQuote);
    if (matches.length === 1) return matches[0];
    if (matches.length === 0) return null;
  }

  // 3. Multiple matches found. Try context disambiguation.
  if (matches.length > 1) {
    const contexts = [
      { b: contextBefore || '', a: contextAfter || '' },
      { b: contextBefore || '', a: '' },
      { b: '', a: contextAfter || '' },
    ];

    for (const ctx of contexts) {
      if (!ctx.b && !ctx.a) continue;

      const extendedQuote = `${ctx.b}${exactQuote}${ctx.a}`;

      // Try designated paragraph first
      if (targetP) {
        const pLocs = findMatchesInText(targetP.text, extendedQuote);
        if (pLocs.length === 1) {
          return {
            paragraph_id: targetP.id,
            char_start: pLocs[0].char_start + ctx.b.length,
            char_end: pLocs[0].char_end - ctx.a.length,
          };
        }
      }

      // Try whole text
      const fMatches = findMatchesInEssay(paragraphs, extendedQuote);
      if (fMatches.length === 1) {
        return {
          paragraph_id: fMatches[0].paragraph_id,
          char_start: fMatches[0].char_start + ctx.b.length,
          char_end: fMatches[0].char_end - ctx.a.length,
        };
      }
    }

    logger.warn(
      'Multiple matches found and context disambiguation failed. Using first match.',
    );
    return matches[0];
  }

  return null;
}
