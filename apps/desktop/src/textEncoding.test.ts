import { decodeTextBuffer } from './textEncoding';

const fromHex = (hex: string) => new Uint8Array(Buffer.from(hex.replace(/\s+/g, ''), 'hex'));

// 道可道，非常道。名可名，非常名。
const DAODEJING = '道可道，非常道。名可名，非常名。';
const DAODEJING_BIG5 = 'b944a569b944a141ab44b160b944a143a657a569a657a141ab44b160a657a143';
const DAODEJING_GB = 'b5c0bfc9b5c0a3acb7c7b3a3b5c0a1a3c3fbbfc9c3fba3acb7c7b3a3c3fba1a3';

// 日本書紀は日本の歴史書である。
const NIHONSHOKI = '日本書紀は日本の歴史書である。';
const NIHONSHOKI_SJIS = '93fa967b8f918b4982cd93fa967b82cc97f08e6a8f9182c582a082e98142';

describe('decodeTextBuffer', () => {
  test('passes plain UTF-8 through', () => {
    const result = decodeTextBuffer(Buffer.from(`${DAODEJING}\nplain ascii`, 'utf-8'));
    expect(result.encoding).toBe('utf-8');
    expect(result.text).toContain(DAODEJING);
  });

  test('strips UTF-8 BOM', () => {
    const result = decodeTextBuffer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('hello')]));
    expect(result.encoding).toBe('utf-8');
    expect(result.text).toBe('hello');
  });

  test('decodes UTF-16LE with BOM', () => {
    const result = decodeTextBuffer(Buffer.from(`﻿${DAODEJING}`, 'utf16le'));
    expect(result.encoding).toBe('utf-16le');
    expect(result.text).toBe(DAODEJING);
  });

  test('detects GB18030', () => {
    const result = decodeTextBuffer(fromHex(DAODEJING_GB));
    expect(result.encoding).toBe('gb18030');
    expect(result.text).toBe(DAODEJING);
  });

  test('detects Big5', () => {
    const result = decodeTextBuffer(fromHex(DAODEJING_BIG5));
    expect(result.encoding).toBe('big5');
    expect(result.text).toBe(DAODEJING);
  });

  test('detects Shift_JIS', () => {
    const result = decodeTextBuffer(fromHex(NIHONSHOKI_SJIS));
    expect(result.encoding).toBe('shift_jis');
    expect(result.text).toBe(NIHONSHOKI);
  });
});
