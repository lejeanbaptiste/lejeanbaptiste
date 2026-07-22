/** @jest-environment jsdom */

import Entity from './Entity';
import { syncCorrectionEntityDom } from './correctionDom';

const fakeWriter = (body: HTMLElement) =>
  ({
    editor: { getBody: () => body },
  }) as any;

describe('syncCorrectionEntityDom', () => {
  it('sets corrected text and data-sic-text for sic/corr substitutions', () => {
    document.body.innerHTML =
      '<span id="dom_1" _tag="choice" class="entity correction">when</span>';

    const entity = new Entity({
      id: 'dom_1',
      tag: 'choice',
      type: 'correction',
      customValues: { sicText: 'when', corrText: 'then' },
    });

    syncCorrectionEntityDom(fakeWriter(document.body), entity);

    const span = document.getElementById('dom_1');
    expect(span?.textContent).toBe('then');
    expect(span?.getAttribute('data-sic-text')).toBe('when');
    expect(entity.getContent()).toBe('then');
  });

  it('removes data-sic-text for supplied and surplus tags', () => {
    document.body.innerHTML =
      '<span id="dom_2" _tag="supplied" class="entity correction" data-sic-text="old">added</span>';

    const entity = new Entity({
      id: 'dom_2',
      tag: 'supplied',
      type: 'correction',
      content: 'added',
    });

    syncCorrectionEntityDom(fakeWriter(document.body), entity);

    const span = document.getElementById('dom_2');
    expect(span?.textContent).toBe('added');
    expect(span?.hasAttribute('data-sic-text')).toBe(false);
  });
});
