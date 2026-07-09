import { DOMParser } from '@xmldom/xmldom';

import { flattenRelaxNgGrammar } from './relaxNgFlatten';

const WRAPPER = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0" ns="http://www.tei-c.org/ns/1.0"><include href="tei_all.tei.rng"><define name="date"><element name="date"><ref name="ljb.sanmiao.era"/></element></define></include><define name="ljb.sanmiao.era"><element name="era"><text/></element></define></grammar>`;

const CORE = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0"><define name="date"><element name="date"><ref name="model.phrase"/></element></define><define name="persName"><element name="persName"/></define></grammar>`;

describe('flattenRelaxNgGrammar', () => {
  it('inlines includes, applies override defines, and keeps sibling helper defines', () => {
    const flat = flattenRelaxNgGrammar(WRAPPER, (href) =>
      href === 'tei_all.tei.rng' ? CORE : null,
    );

    expect(flat).not.toContain('<include');
    expect(flat).toContain('persName');
    expect(flat).toContain('ljb.sanmiao.era');

    const doc = new DOMParser().parseFromString(flat, 'application/xml');
    const allDefines = doc.getElementsByTagName('define');
    const dateDefines = Array.from(allDefines).filter(
      (el: Element) => el.getAttribute('name') === 'date',
    );
    expect(dateDefines).toHaveLength(1);
    const dateDefine = dateDefines[0] as Element;
    const refs = dateDefine.getElementsByTagName('ref');
    const hasSanmiaoRef = Array.from(refs).some(
      (ref: Element) => ref.getAttribute('name') === 'ljb.sanmiao.era',
    );
    const hasModelPhraseRef = Array.from(refs).some(
      (ref: Element) => ref.getAttribute('name') === 'model.phrase',
    );
    expect(hasSanmiaoRef).toBe(true);
    expect(hasModelPhraseRef).toBe(false);
  });
});
