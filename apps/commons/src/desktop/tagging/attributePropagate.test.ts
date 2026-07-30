import { countExactTagMatches } from './attributePropagate';

describe('countExactTagMatches', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tinymce-body" class="mce-content-body">
        <persName id="source" _tag="persName" data-key="p1">Ada Lovelace</persName>
        <persName id="keyed" _tag="persName" data-key="p1">Ada Lovelace</persName>
        <persName id="unkeyed" _tag="persName">Ada Lovelace</persName>
        <persName id="other" _tag="persName">Grace Hopper</persName>
      </div>
    `;

    window.writer = {
      editor: {
        getBody: () => document.getElementById('tinymce-body') as HTMLElement,
      },
      tagger: {
        getAttributesForTag: (element: Element) => ({
          key: element.getAttribute('data-key') ?? '',
        }),
      },
    } as typeof window.writer;
  });

  afterEach(() => {
    delete (window as { writer?: unknown }).writer;
  });

  test('counts keyed and unkeyed exact-text matches together', () => {
    const source = document.getElementById('source')!;

    expect(countExactTagMatches(source, 'p1')).toEqual({
      keyed: 2,
      unkeyed: 1,
    });
  });
});
