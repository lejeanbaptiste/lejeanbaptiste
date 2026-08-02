import { getBookmark } from './taggerRuntime';

describe('getBookmark', () => {
  it('clones the live range so later selection.collapse does not shrink the bookmark', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const text = doc.createTextNode('蕭滴冽');
    doc.body.appendChild(text);

    const liveRange = doc.createRange();
    liveRange.setStart(text, 0);
    liveRange.setEnd(text, text.length);

    const editor = {
      selection: {
        getBookmark: () => ({ rng: liveRange, forward: true }),
        moveToBookmark: () => undefined,
      },
    };

    const bookmark = getBookmark(editor) as { rng: Range; forward: boolean };
    expect(bookmark.rng.toString()).toBe('蕭滴冽');
    expect(bookmark.rng).not.toBe(liveRange);

    // Mimic the wrap-popup IME guard: collapse the live selection after bookmarking.
    liveRange.collapse(false);
    expect(liveRange.collapsed).toBe(true);
    expect(bookmark.rng.collapsed).toBe(false);
    expect(bookmark.rng.toString()).toBe('蕭滴冽');
  });
});
