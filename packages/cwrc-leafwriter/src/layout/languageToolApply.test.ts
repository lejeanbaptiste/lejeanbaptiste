/**
 * @jest-environment jsdom
 */
import { applyTextContentReplacement } from './languageToolApply';

describe('applyTextContentReplacement', () => {
  test('replaces within a single text node', () => {
    const root = document.createElement('div');
    root.textContent = 'This is an test.';
    expect(applyTextContentReplacement(root, 8, 2, 'a')).toBe(true);
    expect(root.textContent).toBe('This is a test.');
  });

  test('replaces across nested markup', () => {
    const root = document.createElement('div');
    root.innerHTML = 'This is <em>an</em> test.';
    // "an" starts after "This is " (8 chars)
    expect(applyTextContentReplacement(root, 8, 2, 'a')).toBe(true);
    expect(root.textContent).toBe('This is a test.');
    expect(root.querySelector('em')?.textContent).toBe('a');
  });

  test('returns false when out of range', () => {
    const root = document.createElement('div');
    root.textContent = 'hi';
    expect(applyTextContentReplacement(root, 0, 5, 'x')).toBe(false);
  });
});
