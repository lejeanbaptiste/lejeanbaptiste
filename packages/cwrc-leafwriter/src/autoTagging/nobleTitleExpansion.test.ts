import { expandNobleTitle, expandNobleTitleStrings } from './nobleTitleExpansion';

describe('expandNobleTitle (port of Norbert nt_combos)', () => {
  // person_nt ind 1923, person_id 3651 — 曹操
  const caoCao = {
    dynasty: '魏',
    dynastyId: 48,
    fief: '魏',
    posthumousName: '武',
    rank: '帝',
    templeName: '太祖',
    familyName: '曹',
    givenName: '操',
  };

  it('generates the dynastic-emperor forms for 曹操', () => {
    expect(expandNobleTitleStrings(caoCao).sort()).toEqual(
      ['太祖', '太祖武皇帝', '武帝', '武皇帝', '魏太祖', '魏武帝', '魏武皇帝'].sort(),
    );
  });

  it('recovers both alternate names CBDB stores for 曹操 (武皇帝 posthumous, 太祖 temple)', () => {
    const strings = expandNobleTitleStrings(caoCao);
    expect(strings).toContain('武皇帝');
    expect(strings).toContain('太祖');
  });

  // person_nt ind 1112, person_id 3710 — 劉備
  const liuBei = {
    dynasty: '漢',
    dynastyId: 49,
    fief: '漢',
    posthumousName: '昭烈',
    rank: '帝',
    familyName: '劉',
    givenName: '備',
  };

  it('generates 漢昭烈帝 (the form DILA stores) for 劉備', () => {
    expect(expandNobleTitleStrings(liuBei)).toContain('漢昭烈帝');
  });

  it('never emits a bare dynasty+rank form, which would over-match every emperor of the house', () => {
    expect(expandNobleTitleStrings(liuBei)).not.toContain('漢帝');
    expect(expandNobleTitleStrings(caoCao)).not.toContain('魏帝');
  });

  it('generates the territorial-noble forms, including personal-name variants', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '魏',
      dynastyId: 48,
      fief: '博陵',
      posthumousName: '文簡',
      rank: '王',
      familyName: '元',
      givenName: '順',
    });
    expect(strings).toEqual(
      expect.arrayContaining([
        '魏博陵文簡王', // 朝封謚爵
        '魏博陵王', // 朝封爵
        '博陵文簡王', // 本朝封謚爵
        '魏博陵文簡王元順', // 朝封謚爵姓名
        '魏博陵文簡王順', // 朝封謚爵名
        '博陵王元順', // 封爵姓名
        '博陵王順', // 封爵名
        '博陵文簡王順', // 封謚爵名
      ]),
    );
  });

  it('abbreviates the posthumous name via pn_abr (漢孝武帝 → 漢武帝)', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '漢',
      dynastyId: 43,
      fief: '漢',
      posthumousName: '孝武',
      posthumousNameAbbr: '武',
      rank: '帝',
    });
    expect(strings).toEqual(
      expect.arrayContaining(['漢孝武帝', '漢孝武皇帝', '漢武帝', '孝武帝', '武帝']),
    );
  });

  it('applies the main_dynasties gate to the 皇 infix', () => {
    const base = { dynasty: '漢', fief: '漢', posthumousName: '武', rank: '帝' };
    // 43 (西漢) is a main dynasty; 61 (前仇池) is not.
    expect(expandNobleTitleStrings({ ...base, dynastyId: 43 })).toContain('漢武皇帝');
    expect(expandNobleTitleStrings({ ...base, dynastyId: 61 })).not.toContain('漢武皇帝');
  });

  it('generates the crown-prince forms (太子勇 / 皇太子勇)', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '隋',
      dynastyId: 96,
      fief: '隋',
      rank: '太子',
      givenName: '勇',
    });
    expect(strings).toEqual(expect.arrayContaining(['太子勇', '皇太子勇']));
  });

  it('generates the empress-dowager form with 姓 + 氏, not a given name', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '北魏',
      dynastyId: 89,
      fief: '北魏',
      rank: '太后',
      familyName: '常',
      givenName: '某',
    });
    expect(strings).toContain('皇太后常氏');
    expect(strings).not.toContain('皇太后常某');
  });

  it('generates 朝謚爵 for a dynastic non-emperor rank (梁安固公主)', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '梁',
      dynastyId: 85,
      fief: '梁',
      posthumousName: '安固',
      rank: '公主',
    });
    expect(strings).toContain('梁安固公主');
  });

  it('treats a multi-character dynasty label by its last character (三國魏 + 魏 is dynastic)', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '三國魏',
      dynastyId: 48,
      fief: '魏',
      posthumousName: '武',
      rank: '帝',
    });
    expect(strings).toContain('三國魏武帝');
    // Dynastic, so the territorial form (dyn+fief+pn+nt) must not appear.
    expect(strings).not.toContain('三國魏魏武帝');
  });

  it('drops a rule when any component it needs is missing', () => {
    // No posthumous name → no 謚-bearing forms, but 朝封爵 still fires.
    const strings = expandNobleTitleStrings({
      dynasty: '魏',
      dynastyId: 48,
      fief: '博陵',
      rank: '王',
    });
    expect(strings).toContain('魏博陵王');
    expect(strings.some((s) => s.includes('文簡'))).toBe(false);
  });

  it('requires a fief for the dyn+fief block, but not for 朝廟', () => {
    const strings = expandNobleTitleStrings({
      dynasty: '魏',
      dynastyId: 48,
      posthumousName: '武',
      rank: '帝',
      templeName: '太祖',
    });
    expect(strings).toContain('魏太祖'); // 朝廟 — no fief needed
    expect(strings).not.toContain('魏武帝'); // needs fief present
  });

  it('excludes non-dynasty dynasty ids (先秦 / 三皇五帝)', () => {
    for (const dynastyId of [1, 2]) {
      expect(
        expandNobleTitleStrings({ dynasty: '先秦', dynastyId, fief: '魯', rank: '公' }),
      ).toEqual([]);
    }
  });

  it('marks abbreviated forms as dynasty-scoped and qualified forms as not', () => {
    const expanded = expandNobleTitle(caoCao);
    expect(expanded.find((e) => e.text === '魏武帝')!.dynastyScoped).toBe(false);
    expect(expanded.find((e) => e.text === '武帝')!.dynastyScoped).toBe(true);
    expect(expanded.find((e) => e.text === '太祖')!.dynastyScoped).toBe(true);
  });

  it('flags strings that embed a personal name', () => {
    const expanded = expandNobleTitle({
      dynasty: '魏',
      dynastyId: 48,
      fief: '博陵',
      posthumousName: '文簡',
      rank: '王',
      familyName: '元',
      givenName: '順',
    });
    expect(expanded.find((e) => e.text === '博陵王元順')!.includesPersonName).toBe(true);
    expect(expanded.find((e) => e.text === '魏博陵王')!.includesPersonName).toBe(false);
  });

  describe('corrections', () => {
    // 周 dynasty king: dyn === fief === 周, rank 王.
    const zhouKing = {
      dynasty: '周',
      dynastyId: 42,
      fief: '周',
      posthumousName: '文',
      rank: '王',
    };

    it('drops the malformed 皇 infix on non-emperor ranks (武皇王 / 文皇公)', () => {
      expect(expandNobleTitleStrings(zhouKing)).not.toContain('文皇王');
      expect(expandNobleTitleStrings({ ...zhouKing, rank: '公' })).not.toContain('文皇公');
    });

    it('keeps the 皇 infix where it is a real form (皇帝, 皇后)', () => {
      expect(expandNobleTitleStrings({ ...zhouKing, rank: '帝' })).toContain('文皇帝');
      expect(expandNobleTitleStrings({ ...zhouKing, rank: '后' })).toContain('文皇后');
    });

    it('is purely subtractive: corrected output is a subset of faithful output', () => {
      for (const rank of ['帝', '王', '公', '后', '太子', '天皇']) {
        const row = { ...zhouKing, rank };
        const faithful = new Set(expandNobleTitleStrings(row, { corrections: false }));
        for (const s of expandNobleTitleStrings(row)) expect(faithful.has(s)).toBe(true);
      }
    });

    it('routes a multi-character house whose fief is its own name as dynastic', () => {
      const wuyue = {
        dynasty: '吳越',
        dynastyId: 104,
        fief: '吳越',
        posthumousName: '武肅',
        rank: '王',
      };
      // Corrected: dynastic, so no doubled dyn+fief string.
      expect(expandNobleTitleStrings(wuyue)).toContain('吳越武肅王');
      expect(expandNobleTitleStrings(wuyue)).not.toContain('吳越吳越武肅王');
      // Faithful mode still reproduces the original's doubling.
      expect(expandNobleTitleStrings(wuyue, { corrections: false })).toContain('吳越吳越武肅王');
    });

    it('still treats a longer dynasty label with a shorter fief as territorial', () => {
      const strings = expandNobleTitleStrings({
        dynasty: '三國魏',
        dynastyId: 48,
        fief: '博陵',
        posthumousName: '文簡',
        rank: '王',
      });
      expect(strings).toContain('三國魏博陵文簡王');
    });
  });

  it('can emit only the dynasty-qualified block', () => {
    const strings = expandNobleTitleStrings(caoCao, { abbreviated: false });
    expect(strings).toContain('魏武帝');
    expect(strings).not.toContain('武帝');
  });
});
