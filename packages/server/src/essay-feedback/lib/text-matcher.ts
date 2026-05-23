import { Logger } from '@nestjs/common';
import { diff_match_patch } from 'diff-match-patch';
import type { EssayFeedbackParagraph } from '@koh/common';

/*Figured I'd paste the whole prompt I used since it outlines the logic and some design decisions:

So right now there exists an issue where the annotation's `char_start` and `char_end` are wildly off. I strongly believe this is due to how LLMs process things in tokens, making character counting impossible for them to get right. I propose the following solution that I need you to implement:
- Instead of getting the `char_start` and `char_end` from the LLM, we should try to match the quote it gives with the original text (and probably make it more strict that the LLM MUST provide an extract quote).
- We should follow a 3 stage approach to matching the quote with the original text:
  1. Find the exact match. Doing something like `const startIndex = essay.indexOf(annotation.exact_quote);`  and `const endIndex = startIndex + annotation.exact_quote.length;`
  2. If that fails, do a nest.js warn message and then do a fuzzy match. I suggest using the `diff-match-patch` package I added unless you have another idea.
  3. If fuzzy matching fails, leave `char_start` and `char_end` as null. Then, handle it on the frontend by simply not underlining anything if this happens and to just leave the little marker beside the paragraph mentioning that there would be an annotation here (I think the frontend already does this)
- We need to also handle duplicate matches. To do this, we should ask the LLM for some "context_before_quote" and "context_after_quote". If there were duplicate matches, perform the string match check a second time with the extra context before and after.
- With the text matching, we should first try to find the quote in the designated paragraph id the LLM gave us. So in total the logic looks something like:
  1. First try to findCharIndices() looking at only 1 paragraph, using the LLM's given `paragraph_id` and `direct_quote`. Use the direct match, fuzzy match, and return null if fail.
    1. If there is one match -> success
    2. If the returned indices are null, look at the whole text. And match using the direct, fuzzy, then return null if fail (can assume that I always mean this going forward).
       1. If one match-> success
       2. If fails again -> return null
       3. If multiple matches, follow the same algorithm as below
    3. If there are multiple matches, now try `context_before_quote + exact_quote + context_after_quote`, `context_before_quote + exact_quote`, and `exact quote + context_after_quote` simultaneously. Cases are as follows:
        1. If any has just one match -> success, return any successful one.
        2. If they all have no matches, log the warning and just return the first copy from the original match with just `exact_quote` (this means that the additional context might've been malformed)
        3. If any number of them have multiple matches (and none of them has just one match), log the warning and then just return the first copy from the original match with just the `exact_quote` (this means the additional context was probably blank - or there's also a slim chance that there's STILL duplicates after enlarging the quote)
*/

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
  paragraphs: EssayFeedbackParagraph[],
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
  paragraphs: EssayFeedbackParagraph[],
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
