import { parseValidInsertions, verifySegmentInsertions } from './verifyInsertions';

describe('parseValidInsertions', () => {
  it('accepts valid anchor insertions and rejects bad marks', () => {
    const json = JSON.stringify({
      insertions: [
        { mark: '。', left: '之', occurrence: 1 },
        { mark: '(', left: '甲', occurrence: 1 },
      ],
    });
    const items = parseValidInsertions(json);
    expect(items).toHaveLength(1);
    expect(items[0]?.mark).toBe('。');
  });

  it('returns empty on malformed JSON', () => {
    expect(parseValidInsertions('not json')).toEqual([]);
  });
});

describe('verifySegmentInsertions', () => {
  const han = '學而時習之不亦說乎';

  it('resolves left+occurrence to afterHan', () => {
    const { verified, dropped } = verifySegmentInsertions(
      han,
      [{ mark: '，', left: '之', occurrence: 1 }],
      10,
    );
    expect(dropped).toBe(0);
    expect(verified).toHaveLength(1);
    expect(verified[0]?.afterHan).toBe(4);
    expect(verified[0]?.global_han).toBe(14);
  });

  it('drops unknown left string', () => {
    const { verified, dropped } = verifySegmentInsertions(
      han,
      [{ mark: '。', left: 'wrong', occurrence: 1 }],
      0,
    );
    expect(verified).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it('uses occurrence for repeated characters', () => {
    const text = '不不不';
    const { verified, dropped } = verifySegmentInsertions(
      text,
      [{ mark: '，', left: '不', occurrence: 2 }],
      0,
    );
    expect(dropped).toBe(0);
    expect(verified[0]?.afterHan).toBe(1);
  });
});
