/**
 * @jest-environment jsdom
 */
import {
  collectDatesFromSourceUnitXml,
  replaceDatesWithPlaceholdersInSourceXml,
} from './sourceUnitDates';

describe('replaceDatesWithPlaceholdersInSourceXml', () => {
  test('replaces each <date> with {{date:N}} in document order', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '三年春正月<date when="0481-02-15"><year>三年</year><month>正月</month><gz>壬戌</gz><lp>朔</lp></date>' +
      '诏百官，十五日' +
      '<date when="0481-03-01"><day>十五</day><gz>丙子</gz></date>' +
      '以显达。</p>';

    const rewritten = replaceDatesWithPlaceholdersInSourceXml(xml);
    expect(rewritten).toContain('{{date:0}}');
    expect(rewritten).toContain('{{date:1}}');
    expect(rewritten).not.toContain('<date');
    expect(rewritten).not.toContain('壬戌');
    expect(rewritten).not.toContain('丙子');
    // Surrounding prose stays.
    expect(rewritten).toContain('三年春正月');
    expect(rewritten).toContain('诏百官');
  });

  test('indices match collectDatesFromSourceUnitXml', () => {
    const xml =
      '<p><date when="0481-02-15"><gz>壬戌</gz></date> and <date when="0481-03-01"><gz>丙子</gz></date></p>';
    const hits = collectDatesFromSourceUnitXml(xml, 'en');
    const rewritten = replaceDatesWithPlaceholdersInSourceXml(xml);
    expect(hits).toHaveLength(2);
    expect(rewritten).toContain(`{{date:0}}`);
    expect(rewritten).toContain(`{{date:1}}`);
    expect(hits[0]!.surface).toContain('壬戌');
    expect(hits[1]!.surface).toContain('丙子');
  });

  test('returns original when there are no dates', () => {
    const xml = '<p>no dates here</p>';
    expect(replaceDatesWithPlaceholdersInSourceXml(xml)).toBe(xml);
  });
});
