import JSZip from 'jszip';
import { extractOdtTextFromBuffer, extractOdtTextFromContentXml } from './odtText';

const wrapContentXml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body><office:text>${body}</office:text></office:body>
</office:document-content>`;

describe('odtText', () => {
  test('extracts paragraphs and headings as blank-line separated text', () => {
    const { text, warnings } = extractOdtTextFromContentXml(
      wrapContentXml(
        '<text:h text:outline-level="1">太清金液神丹經</text:h>' +
          '<text:p>道可道，非常道。</text:p>' +
          '<text:p>名可名，<text:span text:style-name="T1">非常名</text:span>。</text:p>',
      ),
    );
    expect(text).toBe('太清金液神丹經\n\n道可道，非常道。\n\n名可名，非常名。');
    expect(warnings).toEqual([]);
  });

  test('expands spaces, tabs, and line breaks; skips footnotes', () => {
    const { text, warnings } = extractOdtTextFromContentXml(
      wrapContentXml(
        '<text:p>a<text:s text:c="3"/>b<text:tab/>c<text:line-break/>d' +
          '<text:note text:note-class="footnote"><text:note-body><text:p>note</text:p></text:note-body></text:note>e</text:p>',
      ),
    );
    expect(text).toBe('a   b\tc\nde');
    expect(warnings).toHaveLength(1);
  });

  test('drops empty paragraphs', () => {
    const { text } = extractOdtTextFromContentXml(
      wrapContentXml('<text:p>one</text:p><text:p/><text:p>  </text:p><text:p>two</text:p>'),
    );
    expect(text).toBe('one\n\ntwo');
  });

  test('reads content.xml out of a zipped buffer', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
    zip.file('content.xml', wrapContentXml('<text:p>zipped text</text:p>'));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const { text } = await extractOdtTextFromBuffer(buffer);
    expect(text).toBe('zipped text');
  });

  test('rejects archives without content.xml', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/zip');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(extractOdtTextFromBuffer(buffer)).rejects.toThrow(/content\.xml/);
  });
});
