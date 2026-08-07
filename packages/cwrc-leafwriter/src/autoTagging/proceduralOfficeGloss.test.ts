import {
  parseGeoAdminCompound,
  romanizePlaceStem,
  tryProceduralOfficeTranslation,
} from './proceduralOfficeGloss';

describe('proceduralOfficeGloss', () => {
  it('accepts county magistrate and commandery governor compounds', () => {
    expect(parseGeoAdminCompound('枝江令')).toEqual({ stem: '枝江', suffix: '令' });
    expect(parseGeoAdminCompound('豫章太守')).toEqual({ stem: '豫章', suffix: '太守' });
  });

  it('accepts X州刺史 place compounds, including 同州', () => {
    expect(parseGeoAdminCompound('豫州刺史')).toEqual({ stem: '豫州', suffix: '刺史' });
    expect(parseGeoAdminCompound('同州刺史')).toEqual({ stem: '同州', suffix: '刺史' });
  });

  it('rejects 州-final stems for 令/太守 but accepts 同 as a place', () => {
    expect(parseGeoAdminCompound('豫州令')).toBeNull();
    expect(parseGeoAdminCompound('同州太守')).toBeNull();
    expect(parseGeoAdminCompound('同安太守')).not.toBeNull();
  });

  it('rejects institutional 令 titles', () => {
    expect(parseGeoAdminCompound('尚書令')).toBeNull();
    expect(parseGeoAdminCompound('黃門令')).toBeNull();
    expect(parseGeoAdminCompound('縣令')).toBeNull();
  });

  it('rejects prefixed and dynasty-glued compounds', () => {
    expect(parseGeoAdminCompound('督太守')).toBeNull();
    expect(parseGeoAdminCompound('北魏華山太守')).toBeNull();
    expect(parseGeoAdminCompound('遷安固太守')).toBeNull();
  });

  it('romanizes place stems as concatenated toneless pinyin', () => {
    expect(romanizePlaceStem('遼東')).toBe('Liaodong');
    expect(romanizePlaceStem('枝江')).toBe('Zhijiang');
  });

  it('composes English and French glosses from the default suffix map', () => {
    const result = tryProceduralOfficeTranslation('豫章太守');
    expect(result?.en).toBe('Commandery Governor of Yuzhang');
    expect(result?.fr).toBe('gouverneur de commanderie de Yuzhang');
    expect(result?.placeRomanization).toBe('Yuzhang');
  });

  it('composes 刺史 of a 州 correctly', () => {
    const result = tryProceduralOfficeTranslation('豫州刺史');
    expect(result?.en).toBe('Regional Inspector of Yuzhou');
    expect(result?.fr).toBe('inspecteur régional de Yuzhou');
  });

  it('returns null for names outside the pattern', () => {
    expect(tryProceduralOfficeTranslation('尚書令')).toBeNull();
    expect(tryProceduralOfficeTranslation('丞相')).toBeNull();
  });
});
