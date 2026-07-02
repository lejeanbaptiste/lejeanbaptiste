import { readFileSync } from 'fs';
import { join } from 'path';
import { citationChipLabel, citeprocHtmlToTei, createCitationRenderer } from './citeproc';
import type { CslJsonItem } from './types';

const stylesDir = join(__dirname, 'styles');
const chicagoNotes = readFileSync(join(stylesDir, 'chicago-note-bibliography.csl'), 'utf-8');
const localeEnUs = readFileSync(join(stylesDir, 'locales-en-US.xml'), 'utf-8');

const BOOK: CslJsonItem = {
  id: 'ABCD1234',
  type: 'book',
  title: 'Empire under the Night Sky',
  author: [{ family: 'Brown', given: 'Alice' }],
  issued: { 'date-parts': [[2020]] },
  publisher: 'University Press',
  'publisher-place': 'Paris',
};

describe('createCitationRenderer (Chicago notes)', () => {
  const renderer = createCitationRenderer(chicagoNotes, localeEnUs);

  test('renders a full note citation with italic title as <hi rend="italic">', () => {
    const rendered = renderer.render({ item: BOOK });
    expect(rendered).toContain('Brown');
    expect(rendered).toContain('<hi rend="italic">Empire under the Night Sky</hi>');
    expect(rendered).not.toContain('<i>');
  });

  test('includes locator and prefix/suffix', () => {
    const rendered = renderer.render({
      item: BOOK,
      locator: '45-47',
      locatorType: 'page',
      prefix: 'see ',
    });
    expect(rendered).toMatch(/see\s/);
    expect(rendered).toMatch(/45/);
  });
});

describe('citeprocHtmlToTei', () => {
  test('maps i/b/small-caps and keeps sup/sub', () => {
    const html =
      'A <i>title</i>, <b>bold</b>, <span style="font-variant:small-caps;">caps</span>, 2<sup>nd</sup>';
    expect(citeprocHtmlToTei(html)).toBe(
      'A <hi rend="italic">title</hi>, <hi rend="bold">bold</hi>, <hi rend="small-caps">caps</hi>, 2<sup>nd</sup>',
    );
  });

  test('escapes XML special characters in text', () => {
    expect(citeprocHtmlToTei('Q &amp; A &lt;3')).toBe('Q &amp; A &lt;3');
  });

  test('unwraps unknown spans', () => {
    expect(citeprocHtmlToTei('<span class="x">plain</span>')).toBe('plain');
  });
});

describe('citationChipLabel', () => {
  test('author + year', () => {
    expect(citationChipLabel(BOOK)).toBe('Brown 2020');
  });

  test('falls back to title when no author', () => {
    expect(citationChipLabel({ id: 'x', type: 'book', title: 'Anon Work' })).toBe('Anon Work');
  });
});
