/**
 * @jest-environment jsdom
 */
import {
  applyEditorialCleanupToRoot,
  applyEditorialCleanupToText,
  mapCaretOffsetThroughEdit,
} from './translationEditorialCleanup';

describe('applyEditorialCleanupToText', () => {
  test('collapses extra spaces and ellipsis in any language', () => {
    expect(applyEditorialCleanupToText('Hello   world...', 'en')).toBe('Hello world…');
    expect(applyEditorialCleanupToText('Bonjour   monde...', 'fr')).toBe('Bonjour monde…');
  });

  test('English: en dashes between numbers, curly quotes, tight punctuation', () => {
    expect(applyEditorialCleanupToText('See 440-483 and pp. 12 - 15.', 'en')).toBe(
      'See 440–483 and pp. 12–15.',
    );
    expect(applyEditorialCleanupToText('He said "hello" and can\'t go.', 'en')).toBe(
      'He said “hello” and can’t go.',
    );
    expect(applyEditorialCleanupToText('Wait , please ; now .', 'en')).toBe('Wait, please; now.');
    // ISO-like dates must not be mangled into en dashes throughout
    expect(applyEditorialCleanupToText('Dated 2020-01-01.', 'en')).toBe('Dated 2020-01-01.');
  });

  test('French: never en dash; guillemets; NBSP before ;:!? ', () => {
    expect(applyEditorialCleanupToText('Voir 440-483 et 12–15.', 'fr')).toBe(
      'Voir 440-483 et 12-15.',
    );
    expect(applyEditorialCleanupToText('Il dit "bonjour".', 'fr')).toBe(
      'Il dit «\u00a0bonjour\u00a0».',
    );
    expect(applyEditorialCleanupToText('Oui ; non : vraiment ! pourquoi ?', 'fr')).toBe(
      'Oui\u00a0; non\u00a0: vraiment\u00a0! pourquoi\u00a0?',
    );
    expect(applyEditorialCleanupToText("Attends , s'il vous plaît.", 'fr')).toBe(
      'Attends, s’il vous plaît.',
    );
  });

  test('German: „…“ quotes and en-dash ranges', () => {
    expect(applyEditorialCleanupToText('Er sagte "Hallo" (440-483).', 'de')).toBe(
      'Er sagte „Hallo“ (440–483).',
    );
  });
});

describe('mapCaretOffsetThroughEdit', () => {
  test('keeps caret stable across ellipsis and space collapse', () => {
    expect(mapCaretOffsetThroughEdit('foo...', 'foo…', 6)).toBe(4);
    expect(mapCaretOffsetThroughEdit('a  b', 'a b', 1)).toBe(1);
    expect(mapCaretOffsetThroughEdit('a  b', 'a b', 4)).toBe(3);
  });
});

describe('applyEditorialCleanupToRoot', () => {
  test('cleans prose but skips entity refs and Zotero bibls', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('See 440-483 and "Cui". '));

    const ref = document.createElement('ref');
    ref.setAttribute('type', 'grognard-entity');
    ref.setAttribute('key', 'person-1');
    ref.textContent = 'Cui Zusi 崔祖思 (440-483)'; // intentional ASCII hyphen — leave alone
    root.appendChild(ref);

    root.appendChild(document.createTextNode(' more  spaces...'));

    const bibl = document.createElement('bibl');
    bibl.setAttribute('type', 'zotero-ref');
    bibl.textContent = 'Smith, "Title" 12-15';
    root.appendChild(bibl);

    const changed = applyEditorialCleanupToRoot(root, 'en');
    expect(changed).toBe(true);
    expect(root.childNodes[0]!.nodeValue).toBe('See 440–483 and “Cui”. ');
    expect(ref.textContent).toBe('Cui Zusi 崔祖思 (440-483)');
    expect(root.childNodes[2]!.nodeValue).toBe(' more spaces…');
    expect(bibl.textContent).toBe('Smith, "Title" 12-15');
  });
});
