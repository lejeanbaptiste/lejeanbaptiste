import { getClosingTagAutoInsert } from './getClosingTagAutoInsert';

describe('getClosingTagAutoInsert', () => {
  test('inserts innermost open tag name and >', () => {
    const content = '<TEI><text><body><p>hello</';
    const offset = content.length;
    expect(getClosingTagAutoInsert(content, offset)).toEqual({
      insertText: 'p>',
      cursorOffset: offset + 2,
    });
  });

  test('closes unclosed nested tag before outer ones', () => {
    const content = '<div><p>hello<em>world</';
    const offset = content.length;
    expect(getClosingTagAutoInsert(content, offset)).toEqual({
      insertText: 'em>',
      cursorOffset: offset + 3,
    });
  });

  test('only inserts the name when > is already present (angle auto-close)', () => {
    // Monaco often leaves `</|>` after typing `/` between auto-closed brackets.
    const content = '<p>hello</>';
    const offset = content.indexOf('</') + 2;
    expect(content[offset]).toBe('>');
    expect(getClosingTagAutoInsert(content, offset)).toEqual({
      insertText: 'p',
      cursorOffset: offset + 'p'.length + 1,
    });
  });

  test('returns null when no open tags remain', () => {
    const content = '<p>hello</p></';
    expect(getClosingTagAutoInsert(content, content.length)).toBeNull();
  });

  test('returns null when not preceded by </', () => {
    const content = '<p>hello/';
    expect(getClosingTagAutoInsert(content, content.length)).toBeNull();
  });

  test('returns null when a tag name has already been started', () => {
    const content = '<p>hello</p';
    const offset = content.indexOf('</') + 2; // after </, before p
    expect(getClosingTagAutoInsert(content, offset)).toBeNull();
  });

  test('handles prefixed tag names', () => {
    const content = '<TEI><cb:div>text</';
    const offset = content.length;
    expect(getClosingTagAutoInsert(content, offset)).toEqual({
      insertText: 'cb:div>',
      cursorOffset: offset + 'cb:div>'.length,
    });
  });
});
