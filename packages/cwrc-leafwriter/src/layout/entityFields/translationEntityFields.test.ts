/**
 * @jest-environment jsdom
 */
import {
  ENTITY_FIELD_ATTR,
  ENTITY_REF_TYPE,
  createEntityFieldElement,
  recalculateEntityFieldsInRoot,
} from './translationEntityFields';
import type { EntitySummary } from './entitySummary';

const person = (): EntitySummary => ({
  id: 'person-1',
  kind: 'person',
  names: [
    { lang: 'zh-Hant', text: '崔祖思' },
    { lang: 'zh-Latn', text: 'Cui Zusi' },
  ],
  primaryName: '崔祖思',
  romanizedName: 'Cui Zusi',
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: 'Cui',
  authorityIds: [],
});

describe('translationEntityFields', () => {
  test('createEntityFieldElement builds an atomic ljb-entity ref', () => {
    const field = createEntityFieldElement(person(), 1);
    expect(field.tagName.toLowerCase()).toBe('ref');
    expect(field.getAttribute('type')).toBe(ENTITY_REF_TYPE);
    expect(field.getAttribute('key')).toBe('person-1');
    expect(field.getAttribute(ENTITY_FIELD_ATTR)).toBe('true');
    expect(field.getAttribute('contenteditable')).toBe('false');
    expect(field.textContent).toBe('Cui Zusi 崔祖思 (440–483)');
  });

  test('recalculateEntityFieldsInRoot applies first vs later display', () => {
    const root = document.createElement('div');
    root.appendChild(createEntityFieldElement(person(), 1));
    root.appendChild(createEntityFieldElement(person(), 2));
    recalculateEntityFieldsInRoot(root, 'person-1', person());
    const texts = Array.from(root.querySelectorAll('ref')).map((el) => el.textContent);
    expect(texts).toEqual(['Cui Zusi 崔祖思 (440–483)', 'Cui Zusi']);
  });

  test('recalculate keeps a custom display spec and first-occurrence extras', () => {
    const root = document.createElement('div');
    const first = createEntityFieldElement(person(), 1);
    const second = createEntityFieldElement(person(), 2, {
      hidden: [],
      bracketsAround: 'family',
      possessive: false,
    });
    root.appendChild(first);
    root.appendChild(second);
    // Delete first so the custom one becomes occurrence 1.
    first.remove();
    recalculateEntityFieldsInRoot(root, 'person-1', person());
    expect(second.textContent).toBe('[Cui] Zusi 崔祖思 (440–483)');
    expect(second.getAttribute('data-display-spec')).toContain('family');
  });
});
