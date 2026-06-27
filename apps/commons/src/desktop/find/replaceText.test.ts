import {
  applyRegexReplacement,
  isReplaceableTextHit,
  replaceAllInContent,
  replaceHitAtOffset,
} from './replaceText';
import { validateAndReplaceAll, validateAndReplaceHit } from './replaceValidation';

const sampleXml =
  '<?xml version="1.0"?><TEI><text><body><p>Hello world</p><p>中<place>国</place></p></body></text></TEI>';

describe('replaceText', () => {
  test('isReplaceableTextHit accepts a match inside one text run', () => {
    const start = sampleXml.indexOf('Hello');
    const end = start + 'Hello'.length;
    expect(isReplaceableTextHit(sampleXml, start, end)).toBe(true);
  });

  test('isReplaceableTextHit rejects a match spanning markup', () => {
    const start = sampleXml.indexOf('中');
    const end = sampleXml.indexOf('</place>');
    expect(isReplaceableTextHit(sampleXml, start, end)).toBe(false);
  });

  test('replaceHitAtOffset splices literal replacement', () => {
    const start = sampleXml.indexOf('world');
    const end = start + 'world'.length;
    const next = replaceHitAtOffset(sampleXml, start, end, 'there');
    expect(next).toContain('Hello there');
    expect(next).not.toContain('Hello world');
  });

  test('applyRegexReplacement substitutes capture groups', () => {
    const match = /(\w+) (\w+)/.exec('Hello world');
    expect(match).not.toBeNull();
    expect(applyRegexReplacement(match!, '$2, $1')).toBe('world, Hello');
    expect(applyRegexReplacement(match!, '$$')).toBe('$');
  });

  test('applyRegexReplacement substitutes \\1 backrefs', () => {
    const match = /(第[一二三十])/.exec('第一');
    expect(match).not.toBeNull();
    expect(applyRegexReplacement(match!, '第<number>\\1</number>')).toBe(
      '第<number>第一</number>',
    );
  });

  test('replaceAllInContent replaces only replaceable hits', () => {
    const xml = '<root><p>aa bb aa</p><p>中<place>国</place></p></root>';
    const { content, count, skippedNonReplaceable } = replaceAllInContent(xml, 'aa', 'xx', false);
    expect(count).toBe(2);
    expect(skippedNonReplaceable).toBe(0);
    expect(content).toContain('<p>xx bb xx</p>');
  });

  test('replaceAllInContent skips hits that cross markup when regex spans tags', () => {
    const xml = '<root><p>中<place>国</place></p></root>';
    const { count, skippedNonReplaceable } = replaceAllInContent(xml, '中.*国', '泰国', true);
    expect(count).toBe(0);
    expect(skippedNonReplaceable).toBe(1);
  });
});

describe('replaceValidation', () => {
  test('validateAndReplaceHit succeeds for safe literal replace', () => {
    const start = sampleXml.indexOf('world');
    const end = start + 'world'.length;
    const outcome = validateAndReplaceHit(sampleXml, start, end, 'there', false, 'world');
    expect(outcome.ok).toBe(true);
    expect(outcome.content).toContain('Hello there');
  });

  test('validateAndReplaceHit rejects cross-markup hit', () => {
    const start = sampleXml.indexOf('中');
    const end = sampleXml.indexOf('</place>');
    const outcome = validateAndReplaceHit(sampleXml, start, end, '泰国', false, '中国');
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('crosses XML markup');
  });

  test('validateAndReplaceHit rejects invalid XML result', () => {
    const xml = '<p>Hello</p>';
    const start = xml.indexOf('Hello');
    const end = start + 'Hello'.length;
    const outcome = validateAndReplaceHit(xml, start, end, 'Hello<', false, 'Hello');
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('invalid XML');
  });

  test('validateAndReplaceAll validates whole file after batch replace', () => {
    const xml = '<root><p>cat cat</p><p>dog</p></root>';
    const outcome = validateAndReplaceAll(xml, 'cat', 'bird', false);
    expect(outcome.ok).toBe(true);
    expect(outcome.count).toBe(2);
    expect(outcome.content).toContain('<p>bird bird</p>');
  });
});
