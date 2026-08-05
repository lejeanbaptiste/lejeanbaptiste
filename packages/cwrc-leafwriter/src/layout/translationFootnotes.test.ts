import {
  FN_BODY_ATTR,
  FN_MARK_ATTR,
  flattenFootnoteNotesForPersist,
  footnoteBodyHtml,
  normalizeFootnoteNotes,
} from './translationFootnotes';

describe('translationFootnotes', () => {
  test('normalize wraps flat note content and numbers marks', () => {
    const root = document.createElement('div');
    root.innerHTML = `Hello <note place="foot">first note</note> and <note place="foot">second</note>.`;
    normalizeFootnoteNotes(root);
    const notes = root.querySelectorAll('note');
    expect(notes).toHaveLength(2);
    expect(notes[0]?.querySelector(`[${FN_MARK_ATTR}]`)?.textContent).toBe('1');
    expect(notes[1]?.querySelector(`[${FN_MARK_ATTR}]`)?.textContent).toBe('2');
    expect(footnoteBodyHtml(notes[0]!)).toBe('first note');
    expect(footnoteBodyHtml(notes[1]!)).toBe('second');
  });

  test('normalize supports a global start index', () => {
    const root = document.createElement('div');
    root.innerHTML = `<note place="foot">third overall</note>`;
    normalizeFootnoteNotes(root, 2);
    expect(root.querySelector(`[${FN_MARK_ATTR}]`)?.textContent).toBe('3');
  });

  test('flatten restores plain TEI notes for disk', () => {
    const root = document.createElement('div');
    root.innerHTML = `<note place="foot"><span ${FN_MARK_ATTR}="true">1</span><span ${FN_BODY_ATTR}="true">only this</span></note>`;
    flattenFootnoteNotesForPersist(root);
    const note = root.querySelector('note');
    expect(note?.getAttribute('contenteditable')).toBeNull();
    expect(note?.innerHTML).toBe('only this');
    expect(note?.querySelector(`[${FN_MARK_ATTR}]`)).toBeNull();
  });

  test('normalize pulls swallowed body text into the hidden body slot', () => {
    const root = document.createElement('div');
    // Simulate Chrome absorbing following text into an empty note.
    root.innerHTML = `He <note place="foot">never put down his books.</note>`;
    normalizeFootnoteNotes(root);
    expect(root.textContent).toContain('He');
    expect(footnoteBodyHtml(root.querySelector('note')!)).toBe('never put down his books.');
    expect(root.querySelector(`[${FN_MARK_ATTR}]`)?.textContent).toBe('1');
  });
});
