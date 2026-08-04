import {
  convertMarkdownInXmlFragment,
  looksLikeInlineMarkdown,
  markdownInlineToTei,
} from './markdownToTei';

describe('markdownInlineToTei', () => {
  test('converts bold, italic, and strike', () => {
    expect(markdownInlineToTei('See **Deng Cheng** and *Yi Cao* then ~~old~~.')).toBe(
      'See <hi rend="bold">Deng Cheng</hi> and <hi rend="italic">Yi Cao</hi> then <hi rend="strikethrough">old</hi>.',
    );
  });

  test('handles triple markers as bold+italic', () => {
    expect(markdownInlineToTei('***both***')).toBe(
      '<hi rend="bold"><hi rend="italic">both</hi></hi>',
    );
  });

  test('leaves plain text alone', () => {
    expect(markdownInlineToTei('No markers here.')).toBe('No markers here.');
    expect(looksLikeInlineMarkdown('No markers here.')).toBe(false);
  });

  test('escapes XML in converted text', () => {
    expect(markdownInlineToTei('**a < b**')).toBe('<hi rend="bold">a &lt; b</hi>');
  });
});

describe('convertMarkdownInXmlFragment', () => {
  test('rewrites text nodes inside a fragment', () => {
    const doc = new DOMParser().parseFromString(
      '<fragment>He appointed **Deng Cheng** and *Qiu*.</fragment>',
      'application/xml',
    );
    convertMarkdownInXmlFragment(doc.documentElement);
    const html = new XMLSerializer().serializeToString(doc.documentElement);
    expect(html).toContain('rend="bold"');
    expect(html).toContain('Deng Cheng');
    expect(html).toContain('rend="italic"');
    expect(html).not.toContain('**');
  });
});
