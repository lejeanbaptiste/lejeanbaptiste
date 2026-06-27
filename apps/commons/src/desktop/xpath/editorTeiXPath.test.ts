import {
  findEditorNodeByMatchingTeiXPath,
  getTeiXPathFromEditorElement,
} from './editorTeiXPath';
import { matchesTeiTag } from './teiXPathWalker';

describe('editorTeiXPath', () => {
  const bodyHtml = `
    <div _tag="TEI">
      <div _tag="text">
        <div _tag="body">
          <div _tag="p">First</div>
          <div _tag="p">Second</div>
        </div>
      </div>
    </div>
  `;

  const createBody = () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = bodyHtml;
    return doc.body;
  };

  test('builds TEI xpath from editor element', () => {
    const body = createBody();
    const paragraphs = Array.from(body.querySelectorAll('div[_tag="p"]'));
    expect(paragraphs).toHaveLength(2);

    const xpath = getTeiXPathFromEditorElement(paragraphs[1], body);
    expect(xpath).toContain('p[2]');
  });

  test('findEditorNodeByMatchingTeiXPath matches stored xpath via query', () => {
    const body = createBody();
    const paragraphs = Array.from(body.querySelectorAll('div[_tag="p"]'));
    const stored = getTeiXPathFromEditorElement(paragraphs[1], body);

    window.writer = {
      utilities: {
        evaluateXPathAll: () => paragraphs,
      },
    } as unknown as typeof window.writer;

    const found = findEditorNodeByMatchingTeiXPath(body, stored, '//p');
    expect(found?.textContent).toContain('Second');

    delete (window as { writer?: unknown }).writer;
  });

  test('matchesTeiTag handles namespace prefixes', () => {
    expect(matchesTeiTag('cb:div', 'div')).toBe(true);
    expect(matchesTeiTag('cb:div', 'cb:div')).toBe(true);
  });
});
