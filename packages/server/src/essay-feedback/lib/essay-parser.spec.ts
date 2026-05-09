import { parseEssay } from './essay-parser';

describe('parseEssay', () => {
  it('splits on blank lines and assigns p1, p2 ids', () => {
    const paragraphs = parseEssay('First block.\n\nSecond block.');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].id).toBe('p1');
    expect(paragraphs[1].id).toBe('p2');
    expect(paragraphs[0].text).toContain('First');
  });

  it('throws on empty input', () => {
    expect(() => parseEssay('   ')).toThrow();
  });
});
