import { stripXmlToParallelText } from './kanripoParallelText';

describe('stripXmlToParallelText', () => {
  test('keeps Han, punctuation, and paragraph breaks; drops tags', () => {
    const xml = '<TEI><text><body><p>甲、乙。</p><p>丙丁</p></body></text></TEI>';
    const text = stripXmlToParallelText(xml);
    expect(text).toContain('甲、乙。');
    expect(text).toContain('丙丁');
    expect(text).not.toContain('<p>');
    expect(text.split('\n').length).toBeGreaterThan(1);
  });
});
