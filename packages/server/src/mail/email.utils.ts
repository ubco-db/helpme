import * as cheerio from 'cheerio';

export function validateHtml(html: string): void {
  const selfClosingTags = 'br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr';
  
  const openingTagsRegex = new RegExp(
    `<(?!\\/)(?!${selfClosingTags})([a-zA-Z][a-zA-Z0-9]*)[^>]*(?<!\\/)>`,
    'g'
  );  
  const closingTagsRegex = /<\/([a-zA-Z][a-zA-Z0-9]*)>/g;
  
  const originalClosingTags = html.match(closingTagsRegex) || [];  
  const $ = cheerio.load(html, { xmlMode: false }, false);
  const serialized = $.html();
  
  const serializedClosingTags = serialized.match(closingTagsRegex) || [];  
  const difference = serializedClosingTags.length - originalClosingTags.length;
  if (originalClosingTags.length !== serializedClosingTags.length) {
    throw new Error(
      difference > 0
        ? `Invalid HTML: You have ${difference} unclosed tag(s).`
        : `Invalid HTML: You have ${Math.abs(difference)} orphaned closing tag(s) without opening tags.`,
    );
  }
  const lengthDifference = Math.abs(serialized.length - html.length);
  const maxAllowedDifference = Math.max(100, html.length * 0.05);
  
  if (lengthDifference > maxAllowedDifference) {
    throw new Error(
      `Invalid HTML: Structure significantly modified after parsing (${lengthDifference} chars changed).`
    );
  }
}
