/**
 * @jest-environment jsdom
 */
import {
  ENTITY_FIELD_ATTR,
  ENTITY_REF_TYPE,
  ENTITY_WORK_STYLE_ATTR,
  createEntityFieldElement,
  recalculateEntityFieldsInRoot,
} from './translationEntityFields';
import type { EntitySummary } from './entitySummary';
import { EMPTY_DISPLAY_SPEC } from './entityDisplay';

const person = (): EntitySummary => ({
  id: 'person-1',
  kind: 'person',
  names: [
    { lang: 'zh-Hant', text: '崔祖思' },
    { lang: 'zh-Latn', text: 'Cui Zusi' },
  ],
  primaryName: '崔祖思',
  romanizedName: 'Cui Zusi',
  translations: [],
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: 'Cui',
  authorityIds: [],
  classification: null,
  workType: null,
});

const work = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'work-1',
  kind: 'work',
  names: [
    { lang: 'zh-Latn', text: 'Qi zhi' },
    { lang: 'zh-Hant', text: '七志' },
  ],
  primaryName: '七志',
  romanizedName: 'Qi zhi',
  translations: [],
  description: null,
  dates: null,
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
});

const italicText = (field: Element): string =>
  Array.from(field.querySelectorAll('hi[rend="italic"]'))
    .map((node) => node.textContent ?? '')
    .join('');

describe('translationEntityFields', () => {
  test('createEntityFieldElement builds an atomic grognard-entity ref', () => {
    const field = createEntityFieldElement(person(), 1);
    expect(field.tagName.toLowerCase()).toBe('ref');
    expect(field.getAttribute('type')).toBe(ENTITY_REF_TYPE);
    expect(field.getAttribute('key')).toBe('person-1');
    expect(field.getAttribute(ENTITY_FIELD_ATTR)).toBe('true');
    expect(field.getAttribute('contenteditable')).toBe('false');
    expect(field.textContent).toBe('Cui Zusi 崔祖思 (440–483)');
  });

  test('preserves a stored display-spec recipe across recalculate', () => {
    const root = document.createElement('div');
    const first = createEntityFieldElement(person(), 1, {
      hidden: [],
      bracketsAround: 'family',
      possessive: false,
    });
    const second = createEntityFieldElement(person(), 2, {
      hidden: [],
      bracketsAround: 'family',
      possessive: false,
    });
    root.appendChild(first);
    root.appendChild(second);
    expect(second.textContent).toBe('[Cui] Zusi');
    // Delete first so the custom one becomes occurrence 1.
    first.remove();
    recalculateEntityFieldsInRoot(root, 'person-1', person());
    expect(second.textContent).toBe('[Cui] Zusi 崔祖思 (440–483)');
    expect(second.getAttribute('data-display-spec')).toContain('family');
  });

  test('a book-typed work italicizes only the romanization, not Chinese', () => {
    const field = createEntityFieldElement(work({ workType: 'book' }), 1);
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBe('italic');
    expect(field.textContent).toBe('Qi zhi 七志');
    expect(italicText(field)).toBe('Qi zhi');
    expect(field.querySelector('hi[rend="italic"]')?.textContent).toBe('Qi zhi');
  });

  test('appends a matching-language translation in parentheses after Chinese', () => {
    const field = createEntityFieldElement(
      work({
        workType: 'book',
        names: [
          { lang: 'zh-Latn', text: 'Jinshu', type: 'primary' },
          { lang: 'zh-Hant', text: '晉書', type: null },
        ],
        primaryName: '晉書',
        romanizedName: 'Jinshu',
        translations: [
          { lang: 'fr', text: 'Livre des Jin' },
          { lang: 'en', text: 'Book of Jin' },
        ],
      }),
      1,
      EMPTY_DISPLAY_SPEC,
      undefined,
      'fr',
    );
    expect(field.textContent).toBe('Jinshu 晉書 (Livre des Jin)');
    expect(italicText(field)).toBe('Jinshu');
  });

  test('translation-first italicizes the gloss and parenthesizes original forms', () => {
    const field = createEntityFieldElement(
      work({
        workType: 'book',
        names: [
          { lang: 'zh-Latn', text: 'Jinshu', type: 'primary' },
          { lang: 'zh-Hant', text: '晉書', type: null },
        ],
        primaryName: '晉書',
        romanizedName: 'Jinshu',
        translations: [{ lang: 'fr', text: 'Livre des Jin' }],
      }),
      1,
      { ...EMPTY_DISPLAY_SPEC, titleConvention: 'translation-first' },
      undefined,
      'fr',
    );
    expect(field.textContent).toBe('Livre des Jin (Jinshu 晉書)');
    expect(italicText(field)).toBe('Livre des Jin');
  });

  test('omits the translation gloss when the target language has none', () => {
    const field = createEntityFieldElement(
      work({
        workType: 'book',
        names: [
          { lang: 'zh-Latn', text: 'Jinshu', type: 'primary' },
          { lang: 'zh-Hant', text: '晉書', type: null },
        ],
        primaryName: '晉書',
        romanizedName: 'Jinshu',
        translations: [{ lang: 'fr', text: 'Livre des Jin' }],
      }),
      1,
      EMPTY_DISPLAY_SPEC,
      undefined,
      'de',
    );
    expect(field.textContent).toBe('Jinshu 晉書');
  });

  test('an unset work type defaults to book (italic romanization)', () => {
    const field = createEntityFieldElement(work({ workType: null }), 1);
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBe('italic');
    expect(italicText(field)).toBe('Qi zhi');
  });

  test('English possessive ’s stays outside the italic run', () => {
    const field = createEntityFieldElement(
      work({ workType: 'book' }),
      1,
      { ...EMPTY_DISPLAY_SPEC, possessive: true },
      undefined,
      'en',
    );
    expect(field.textContent).toBe('Qi zhi’s 七志');
    expect(italicText(field)).toBe('Qi zhi');
    expect(field.textContent?.endsWith('七志')).toBe(true);
  });

  test('a chapter-typed work gets curly quotes around the romanization only', () => {
    const field = createEntityFieldElement(work({ workType: 'chapter' }), 1);
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBeNull();
    expect(field.textContent).toBe('“Qi zhi” 七志');
  });

  test('a painting-typed work also italicizes the romanization', () => {
    const field = createEntityFieldElement(work({ workType: 'painting' }), 1);
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBe('italic');
    expect(italicText(field)).toBe('Qi zhi');
  });

  test('a poem-typed work gets curly quotes around the romanization', () => {
    const field = createEntityFieldElement(work({ workType: 'poem' }), 1);
    expect(field.textContent).toBe('“Qi zhi” 七志');
  });

  test('an object-typed work gets neither italics nor quotes', () => {
    const field = createEntityFieldElement(work({ workType: 'object' }), 1);
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBeNull();
    expect(field.querySelector('hi[rend="italic"]')).toBeNull();
    expect(field.textContent).toBe('Qi zhi 七志');
  });

  test('a person entity never gets work-type styling, even with a stray workType', () => {
    const field = createEntityFieldElement({ ...person(), workType: 'book' }, 1);
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBeNull();
    expect(field.querySelector('hi[rend="italic"]')).toBeNull();
    expect(field.textContent).toBe('Cui Zusi 崔祖思 (440–483)');
  });

  test('recalculateEntityFieldsInRoot re-applies work-type styling', () => {
    const root = document.createElement('div');
    const field = createEntityFieldElement(work({ workType: 'chapter' }), 1);
    root.appendChild(field);
    expect(field.textContent).toBe('“Qi zhi” 七志');
    // Entity's type changed since the field was inserted (e.g. edited in the entity panel).
    recalculateEntityFieldsInRoot(root, 'work-1', work({ workType: 'book' }));
    expect(field.getAttribute(ENTITY_WORK_STYLE_ATTR)).toBe('italic');
    expect(italicText(field)).toBe('Qi zhi');
    expect(field.textContent).toBe('Qi zhi 七志');
  });

  test('Han characters mixed into the romanized name stay upright', () => {
    const field = createEntityFieldElement(
      work({
        workType: 'book',
        names: [{ lang: 'zh-Latn', text: 'Qi zhi 七志' }],
        primaryName: 'Qi zhi 七志',
        romanizedName: 'Qi zhi 七志',
      }),
      1,
      { ...EMPTY_DISPLAY_SPEC, hidden: ['chinese'] },
    );
    expect(field.textContent).toBe('Qi zhi 七志');
    expect(italicText(field)).toBe('Qi zhi ');
  });
});
