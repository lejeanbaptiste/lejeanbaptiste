import { countPropagatableMatches } from './tagPropagate';

describe('countPropagatableMatches', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tinymce-body" class="mce-content-body">
        <p id="p1" _tag="p">Ada Lovelace wrote code.</p>
        <p id="p2" _tag="p"><persName id="pn1" _tag="persName">Ada Lovelace</persName> again.</p>
      </div>
    `;

    window.writer = {
      schemaManager: { getHeader: () => 'teiHeader' },
      editor: {
        getBody: () => document.getElementById('tinymce-body') as HTMLElement,
      },
    } as typeof window.writer;
  });

  afterEach(() => {
    delete (window as { writer?: unknown }).writer;
  });

  test('counts untagged exact matches only', () => {
    expect(countPropagatableMatches('Ada Lovelace', 'persName')).toBe(1);
  });

  test('returns zero for empty search', () => {
    expect(countPropagatableMatches('', 'persName')).toBe(0);
  });

  test('ignores matches inside teiHeader metadata', () => {
    document.body.innerHTML = `
      <div id="tinymce-body" class="mce-content-body">
        <teiheader id="hdr" _tag="teiHeader">
          <appinfo _tag="appInfo">
            <application _tag="application" ident="le-jean-baptiste">
              <label _tag="label">Le Jean-Baptiste</label>
            </application>
          </appinfo>
        </teiheader>
        <p id="p1" _tag="p">Jean wrote code.</p>
      </div>
    `;

    window.writer = {
      schemaManager: { getHeader: () => 'teiHeader' },
      editor: {
        getBody: () => document.getElementById('tinymce-body') as HTMLElement,
      },
    } as typeof window.writer;

    expect(countPropagatableMatches('Jean', 'persName')).toBe(1);
  });
});
