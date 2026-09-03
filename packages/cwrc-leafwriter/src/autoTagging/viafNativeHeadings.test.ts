import { collectViafHeadingTexts, pickNativeViafHeading } from './viafNativeHeadings';

describe('viafNativeHeadings', () => {
  const cluster = {
    'ns1:VIAFCluster': {
      'ns1:mainHeadings': {
        'ns1:data': [
          { 'ns1:text': 'Bdud-ʼjoms ʼJigs-bral-ye-śes-rdo-rje, 1904-1987' },
          { 'ns1:text': 'བདུད་འཇོམས་འཇིགས་བྲལ་ཡེ་ཤེས་རྡོ་རྗེ།' },
        ],
      },
      'ns1:x400s': {
        'ns1:x400': [
          { 'ns1:datafield': { 'ns1:subfield': { code: 'a', content: '敦珠' } } },
          { 'ns1:datafield': { 'ns1:subfield': { code: 'a', content: '敦珠仁波切' } } },
          {
            'ns1:datafield': {
              'ns1:subfield': { code: 'a', content: 'ドゥジョム・リンポチェ' },
            },
          },
        ],
      },
      'ns1:titles': {
        'ns1:work': { 'ns1:text': 'བརྡའ་ཡིག་ཟླ་བའི་འོད་སྣང་ཞེས་བྱ་བ།' },
      },
    },
  };

  it('collects name headings and ignores titles', () => {
    const texts = collectViafHeadingTexts(cluster);
    expect(texts).toEqual(
      expect.arrayContaining([
        'བདུད་འཇོམས་འཇིགས་བྲལ་ཡེ་ཤེས་རྡོ་རྗེ།',
        '敦珠仁波切',
        'ドゥジョム・リンポチェ',
      ]),
    );
    expect(texts.join('')).not.toContain('བརྡའ་ཡིག');
  });

  it('picks Tibetan, Chinese, and Japanese by project script', () => {
    const headings = collectViafHeadingTexts(cluster);
    expect(pickNativeViafHeading(headings, 'bo')).toBe('བདུད་འཇོམས་འཇིགས་བྲལ་ཡེ་ཤེས་རྡོ་རྗེ།');
    expect(pickNativeViafHeading(headings, 'zh-Hant')).toBe('敦珠仁波切');
    expect(pickNativeViafHeading(headings, 'ja')).toBe('ドゥジョム・リンポチェ');
  });

  it('prefers the x400 name that matches the Latin preferred heading', () => {
    const headings = ['Smon-lam-dpal, Khri-chen VIII, 1414-', 'ལེགས་པའི་བློ་གྲོས', 'སྨོན་ལམ་དཔལ།'];
    expect(pickNativeViafHeading(headings, 'bo', 'Smon-lam-dpal, Khri-chen VIII, 1414-')).toBe(
      'སྨོན་ལམ་དཔལ།',
    );
  });

  it('uses LC vernacular x400 when mainHeadings are only Latin', () => {
    const karma = {
      'ns1:mainHeadings': {
        'ns1:data': [{ 'ns1:text': 'Karmā Monalama, Acharya' }],
      },
      'ns1:x400s': {
        'ns1:x400': [
          {
            'ns1:datafield': {
              'ns1:subfield': { code: 'a', content: 'ཀརྨ༌སྨོན༌ལམ' },
            },
          },
        ],
      },
      'ns1:titles': { 'ns1:text': 'བརྡ་ཆད་གཏན་འབེབས་ལས་འཆར། བཙན་བྱོལ་བོད་གཞུང་ཤེས་རིག་ལས་ཁུངས།' },
    };
    const headings = collectViafHeadingTexts(karma);
    expect(pickNativeViafHeading(headings, 'bo', 'Karmā Monalama, Acharya')).toBe('ཀརྨ༌སྨོན༌ལམ');
  });
});
