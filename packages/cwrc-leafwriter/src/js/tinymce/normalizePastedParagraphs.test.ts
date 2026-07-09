import {
  canTagAsParagraph,
  fixNestedPastedParagraphs,
  getEffectiveParentTag,
  isEffectivelyEmptyParagraph,
  normalizePastedParagraphsInFragment,
  PARAGRAPH_TAG,
  removeEmptyParagraphs,
} from './normalizePastedParagraphs';

const blockTag = 'div';

const makeDeps = (insertionParentTag: string | null) => ({
  getUniqueId: (prefix: string) => `${prefix}test`,
  isParagraphValidInParent: (parentTag: string) =>
    parentTag === 'body' || parentTag === 'div' || parentTag === PARAGRAPH_TAG,
  paragraphCanContainText: true,
  blockTag,
  insertionParentTag,
});

describe('normalizePastedParagraphs', () => {
  test('tags untagged paste blocks as TEI paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div>First paragraph</div><div>Second paragraph</div>';

    normalizePastedParagraphsInFragment(root, makeDeps('body'));

    const tagged = root.querySelectorAll('[_tag="p"]');
    expect(tagged).toHaveLength(2);
    expect(tagged[0]?.getAttribute('id')).toBe('dom_test');
    expect(tagged[0]?.getAttribute('_textallowed')).toBe('true');
    expect(tagged[0]?.textContent).toBe('First paragraph');
    expect(tagged[1]?.textContent).toBe('Second paragraph');
  });

  test('converts HTML p elements to tagged div paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>From Word</p>';

    normalizePastedParagraphsInFragment(root, makeDeps('body'));

    const tagged = root.querySelector('[_tag="p"]');
    expect(tagged?.nodeName.toLowerCase()).toBe(blockTag);
    expect(tagged?.textContent).toBe('From Word');
  });

  test('splits a single block on double line breaks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div>One<br><br>Two</div>';

    normalizePastedParagraphsInFragment(root, makeDeps('body'));

    const tagged = root.querySelectorAll('[_tag="p"]');
    expect(tagged).toHaveLength(2);
    expect(tagged[0]?.textContent).toBe('One');
    expect(tagged[1]?.textContent).toBe('Two');
  });

  test('skips blocks when paragraph is not valid in parent', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div>Not allowed</div>';

    normalizePastedParagraphsInFragment(root, {
      ...makeDeps('head'),
      isParagraphValidInParent: () => false,
    });

    expect(root.querySelector('[_tag="p"]')).toBeNull();
  });

  test('uses fragment structural parent when present', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div _tag="body" id="dom_body"><div>Pasted text</div></div>';

    expect(
      getEffectiveParentTag({
        element: root.querySelector('div:not([_tag])') as Element,
        root,
        insertionParentTag: 'head',
      }),
    ).toBe('body');
  });

  test('allows paragraph tagging when pasting inside an existing paragraph', () => {
    expect(canTagAsParagraph(PARAGRAPH_TAG, makeDeps(null).isParagraphValidInParent)).toBe(true);
  });

  test('does not retag content that already has _tag', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div _tag="p" id="dom_existing">Existing</div>';

    normalizePastedParagraphsInFragment(root, makeDeps('body'));

    expect(root.querySelectorAll('[_tag="p"]')).toHaveLength(1);
    expect(root.querySelector('#dom_existing')).not.toBeNull();
  });

  test('hoists nested pasted paragraphs out of an existing paragraph', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div _tag="p" id="dom_outer"><div _tag="p" id="dom_inner">Nested</div></div>';

    fixNestedPastedParagraphs(root);

    const outer = root.querySelector('#dom_outer');
    const inner = root.querySelector('#dom_inner');
    expect(outer?.contains(inner ?? null)).toBe(false);
    expect(inner?.parentElement).toBe(root);
    expect(inner?.previousElementSibling).toBe(outer);
  });

  test('preserves order when hoisting multiple nested pasted paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div _tag="p" id="dom_outer"><div _tag="p" id="dom_inner_1">First</div><div _tag="p" id="dom_inner_2">Second</div><div _tag="p" id="dom_inner_3">Third</div></div>';

    fixNestedPastedParagraphs(root);

    expect(
      Array.from(root.children).map((child) => child.getAttribute('id')),
    ).toEqual(['dom_outer', 'dom_inner_1', 'dom_inner_2', 'dom_inner_3']);
  });

  test('does not tag empty paste blocks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div><br></div><div>Real paragraph</div>';

    normalizePastedParagraphsInFragment(root, makeDeps('body'));

    expect(root.querySelectorAll('[_tag="p"]')).toHaveLength(1);
    expect(root.querySelector('[_tag="p"]')?.textContent).toBe('Real paragraph');
  });

  test('removes empty tagged and untagged paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div _tag="p" id="dom_empty"></div><div _tag="p" id="dom_full">Text</div><div>&nbsp;</div>';

    removeEmptyParagraphs(root, blockTag);

    expect(root.querySelector('#dom_empty')).toBeNull();
    expect(root.querySelector('#dom_full')).not.toBeNull();
    expect(root.querySelectorAll('[_tag="p"]')).toHaveLength(1);
    expect(root.querySelector('div:not([_tag])')).toBeNull();
  });

  test('treats zero-width space paragraphs as empty', () => {
    expect(isEffectivelyEmptyParagraph(document.createElement('div'))).toBe(true);

    const feffOnly = document.createElement('div');
    feffOnly.textContent = '\uFEFF';
    expect(isEffectivelyEmptyParagraph(feffOnly)).toBe(true);
  });
});
