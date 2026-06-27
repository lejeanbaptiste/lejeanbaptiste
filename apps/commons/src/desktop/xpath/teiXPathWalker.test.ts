import { findEditorNodeByTeiXPath, parseTeiXPathSegments } from './teiXPathWalker';

describe('teiXPathWalker', () => {
  const bodyHtml = `
    <div _tag="TEI">
      <div _tag="text">
        <div _tag="body">
          <div _tag="p">First paragraph</div>
          <div _tag="p">Second paragraph</div>
          <div _tag="cb:div">
            <div _tag="p">Nested</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const createBody = () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = bodyHtml;
    return doc.body;
  };

  test('parseTeiXPathSegments handles namespaced tags and indices', () => {
    expect(parseTeiXPathSegments('/TEI/text/body/p[2]')).toEqual([
      { tag: 'TEI', index: 0 },
      { tag: 'text', index: 0 },
      { tag: 'body', index: 0 },
      { tag: 'p', index: 1 },
    ]);
  });

  test('findEditorNodeByTeiXPath locates second paragraph', () => {
    const body = createBody();
    const node = findEditorNodeByTeiXPath(body, '/TEI/text/body/p[2]');
    expect(node).not.toBeNull();
    expect(node?.getAttribute('_tag')).toBe('p');
    expect(node?.textContent).toContain('Second paragraph');
  });

  test('findEditorNodeByTeiXPath locates namespaced cb:div child', () => {
    const body = createBody();
    const node = findEditorNodeByTeiXPath(body, '/TEI/text/body/cb:div[1]/p[1]');
    expect(node).not.toBeNull();
    expect(node?.textContent).toContain('Nested');
  });
});
