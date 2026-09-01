import {
  wrapDaozangTeiDocument,
  uniqueDaozangXmlPath,
  type DaozangTeiMeta,
} from './daozangImportXml';
import type { ProjectFileConfig } from './projectTypes';

const config: ProjectFileConfig = {
  name: 'Test project',
  schema: {
    catalogId: 'teiLite',
    css: 'schema/tei.css',
    rng: 'schema/tei_lite.rng',
  },
  version: 1,
};

const meta: DaozangTeiMeta = {
  title: '太上洞玄靈寶無量度人上品妙經註解',
  dz_no: '91',
  variant: '洞真部玉訣類',
  rel_path: '正統道藏洞真部玉訣類-太上洞玄靈寶無量度人上品妙經注-元-陳致虛.txt',
  stem: '正統道藏洞真部玉訣類-太上洞玄靈寶無量度人上品妙經注-元-陳致虛',
  source: '方瞳子源 Fang Tongzi transcription (homeinmists.com)',
  dzid: 'DZ0091',
  kr_id: 'KR5a0092',
  work_qid: 'Q10286283',
  ws_url: 'https://zh.wikisource.org/wiki/太上洞玄靈寶無量度人上品妙經註',
};

describe('wrapDaozangTeiDocument', () => {
  test('fills DZID, Kanripo, Wikidata, and Wikisource idnos', () => {
    const xml = wrapDaozangTeiDocument({
      config,
      meta,
      bodyXml: '<div type="text"><p>正文。</p></div>',
      importedAt: new Date('2026-08-30T12:00:00Z'),
    });

    expect(xml).toContain('<idno type="Daozang">91</idno>');
    expect(xml).toContain('<idno type="DZID">DZ0091</idno>');
    expect(xml).toContain('<idno type="Kanripo">KR5a0092</idno>');
    expect(xml).toContain('https://www.wikidata.org/entity/Q10286283');
    expect(xml).toContain('subtype="wikisource"');
    expect(xml).toContain('zh.wikisource.org/wiki/');
  });

  test('keeps DPM metadata out of the body', () => {
    const metadataXml =
      '<metadata><citation dz_id="19"/><wikidata><wsPage>太上昇玄消灾護命妙經</wsPage></wikidata></metadata>';
    const xml = wrapDaozangTeiDocument({
      config,
      meta,
      bodyXml: '<div type="text"><p>正文。</p></div>',
      metadataXml,
    });

    expect(xml).not.toContain('<metadata');
    expect(xml).not.toContain('<wsPage>');
    expect(xml).toContain('<p>正文。</p>');
  });

  test('wires title and authors to authority refs', () => {
    const xml = wrapDaozangTeiDocument({
      config,
      meta: {
        ...meta,
        authorship: [
          { person_name: '張白', norbert_id: '1021', function: '注' },
          { person_name: '宋真宗', wikidata_qid: 'Q7264', function: '序' },
        ],
      },
      bodyXml: '<div type="text"><p>正文。</p></div>',
    });

    expect(xml).toContain('ref="https://www.wikidata.org/entity/Q10286283"');
    expect(xml).toContain('<author ref="NORBERT:person-1021" role="注">張白</author>');
    expect(xml).toContain('ref="https://www.wikidata.org/entity/Q7264"');
  });

  test('uses biblStruct for sourceDesc and extent in fileDesc', () => {
    const xml = wrapDaozangTeiDocument({
      config,
      meta: { ...meta, vols: '3' },
      bodyXml: '<div type="text"><p>正文。</p></div>',
    });

    expect(xml).toContain('<biblStruct>');
    expect(xml).toContain('<idno type="Daozang">91</idno>');
    // idno belongs inside biblStruct/monogr, not as a direct child of sourceDesc.
    expect(xml).not.toMatch(/<sourceDesc>\s*<idno/);
    expect(xml).toContain('<extent>3 卷</extent>');
    expect(xml).not.toContain('<profileDesc>\n      <extent>');
  });

  describe('CBETA P5 target', () => {
    const cbetaConfig: ProjectFileConfig = {
      name: 'P5 project',
      schema: { catalogId: 'cbeta', css: 'schema/cbeta.css', rng: 'schema/cbeta_p5.rng' },
      version: 1,
    };
    const juanBody =
      '<div type="juan" n="之三">\n  <head>元始說先天道德經註解卷之三</head>\n  <p>正文。</p>\n</div>';

    test('emits <cb:div> (not TEI <div>) with no @n on the body division', () => {
      const xml = wrapDaozangTeiDocument({
        config: cbetaConfig,
        meta: { ...meta, time_dynasty: '宋' },
        bodyXml: juanBody,
      });
      const body = xml.slice(xml.indexOf('<body>'), xml.indexOf('</body>'));
      expect(body).toContain('<cb:div type="juan">');
      expect(body).not.toMatch(/<div[\s>]/); // no plain TEI <div>
      expect(body).not.toMatch(/<cb:div[^>]*\sn=/);
      expect(body).toContain('<head>元始說先天道德經註解卷之三</head>');
    });

    test('keeps the structured <creation> (valid in CBETA P5)', () => {
      const xml = wrapDaozangTeiDocument({
        config: cbetaConfig,
        meta: { ...meta, time_dynasty: '宋' },
        bodyXml: juanBody,
      });
      expect(xml).toContain('<creation>');
      expect(xml).toContain('<date>宋</date>');
    });

    test('non-CBETA targets keep @n on the division', () => {
      const xml = wrapDaozangTeiDocument({
        config,
        meta: { ...meta, time_dynasty: '元' },
        bodyXml: juanBody,
      });
      expect(xml).toContain('<div type="juan" n="之三">');
      expect(xml).toContain('<creation>');
      expect(xml).toContain('<date>元</date>');
    });
  });

  test('allocates unique xml paths with numeric suffixes', () => {
    const used = new Set<string>();
    const first = uniqueDaozangXmlPath('/proj/imported/daozang', 'stem', used);
    const second = uniqueDaozangXmlPath('/proj/imported/daozang', 'stem', used);
    expect(first).toBe('/proj/imported/daozang/stem.xml');
    expect(second).toBe('/proj/imported/daozang/stem-2.xml');
  });
});
