/**
 * @jest-environment jsdom
 */
import { buildPlaceholderRetryInstruction, missingPlaceholders } from './aiPlaceholderGuard';
import {
  collectEntitiesFromSourceUnitXml,
  normalizePlaceholderSpacing,
  replaceEntitiesWithPlaceholdersInSourceXml,
  substituteOpaquePlaceholders,
} from './sourceUnitEntities';

describe('replaceEntitiesWithPlaceholdersInSourceXml', () => {
  test('blinds keyed roleName / placeName / persName', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<persName key="person-1">陳顯達</persName>为' +
      '<roleName key="office-1">平北將軍</roleName>，' +
      '<placeName key="place-1">江夏郡</placeName>太守' +
      '</p>';
    const keys = new Set(['person-1', 'office-1', 'place-1']);
    const { xml: rewritten, opaques } = replaceEntitiesWithPlaceholdersInSourceXml(xml, keys);
    expect(rewritten).toContain('{{mention:0}}');
    expect(rewritten).toContain('{{mention:1}}');
    expect(rewritten).toContain('{{mention:2}}');
    expect(rewritten).not.toContain('平北將軍');
    expect(opaques).toHaveLength(0);
  });

  test('packs personWrapper as holding + entity with a space between', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '以<name type="personWrapper" key="person-1">' +
      '<roleName key="office-hold">平北將軍</roleName>' +
      '<persName key="person-1">陳顯達</persName>' +
      '</name>為' +
      '<roleName key="office-as">南兖州刺史</roleName>' +
      '</p>';
    const keys = new Set(['person-1', 'office-hold', 'office-as']);
    const { xml: rewritten } = replaceEntitiesWithPlaceholdersInSourceXml(xml, keys);
    expect(rewritten).toContain('{{holding:0}} {{mention:1}}');
    expect(rewritten).toContain('{{as:2}}');
    expect(rewritten).not.toContain('}}{{');
    expect(rewritten).not.toContain('personWrapper');
    expect(rewritten).not.toContain('平北將軍');
  });

  test('leaves nobleTitle (and nested place/role) as plain text to translate', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<name type="personWrapper" key="person-1">' +
      '<nobleTitle><roleName><placeName>貞陽</placeName>公</roleName></nobleTitle>' +
      '<persName key="person-1">柳世隆</persName>' +
      '</name>為' +
      '<nobleTitle><placeName key="place-1">江夏</placeName><roleName>王</roleName></nobleTitle>' +
      '</p>';
    const keys = new Set(['person-1', 'place-1']);
    const { xml: rewritten } = replaceEntitiesWithPlaceholdersInSourceXml(xml, keys);
    expect(rewritten).toContain('貞陽公');
    expect(rewritten).toContain('江夏王');
    expect(rewritten).toContain('{{mention:0}}');
    expect(rewritten).not.toContain('{{entity:place-1}}');
    expect(rewritten).not.toContain('nobleTitle');
    expect(rewritten).not.toContain('{{holding:opaque');
  });

  test('normalizePlaceholderSpacing inserts one space and collapses doubles', () => {
    expect(normalizePlaceholderSpacing('{{holding:0}}{{mention:1}}')).toBe(
      '{{holding:0}} {{mention:1}}',
    );
    expect(normalizePlaceholderSpacing('{{a}}  {{b}}')).toBe('{{a}} {{b}}');
  });

  test('marks unkeyed appointment office after 為 as as:opaque', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '以{{entity:person-1}}為<roleName><placeName>益州</placeName>刺史</roleName>' +
      '</p>';
    // After personWrapper packing the source looks like text+tags; here we only
    // test the unkeyed-after-為 path on a minimal fragment.
    const { xml: rewritten, opaques } = replaceEntitiesWithPlaceholdersInSourceXml(
      xml,
      new Set(['person-1']),
    );
    expect(rewritten).toContain('{{as:opaque:0}}');
    expect(opaques[0]?.surface).toBe('益州刺史');
  });

  test('blinds outermost office when placeName is nested inside keyed roleName', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<roleName key="office-nanyan">' +
      '<placeName key="place-nanyan">南兗州</placeName>刺史' +
      '</roleName>' +
      '</p>';
    const keys = new Set(['office-nanyan', 'place-nanyan']);
    const { xml: rewritten } = replaceEntitiesWithPlaceholdersInSourceXml(xml, keys);
    expect(rewritten).toContain('{{mention:0}}');
    expect(rewritten).not.toContain('{{entity:place-nanyan}}');
  });

  test('opaque-blinds unkeyed office constructions', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<roleName><placeName>益州</placeName>刺史</roleName>' +
      '</p>';
    const { xml: rewritten, opaques } = replaceEntitiesWithPlaceholdersInSourceXml(xml, new Set());
    expect(rewritten).toContain('{{opaque:0}}');
    expect(opaques[0]?.surface).toBe('益州刺史');
  });

  test('opaqueStartIndex offsets opaque indices so independent calls never collide', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<roleName><placeName>益州</placeName>刺史</roleName> and ' +
      '<roleName><placeName>荊州</placeName>刺史</roleName>' +
      '</p>';
    const { xml: rewritten, opaques } = replaceEntitiesWithPlaceholdersInSourceXml(
      xml,
      new Set(),
      5,
    );
    expect(rewritten).toContain('{{opaque:5}}');
    expect(rewritten).toContain('{{opaque:6}}');
    expect(rewritten).not.toContain('{{opaque:0}}');
    expect(opaques.map((hit) => hit.index)).toEqual([5, 6]);
  });

  test('opaqueStartIndex defaults to 0 when omitted', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<roleName><placeName>益州</placeName>刺史</roleName>' +
      '</p>';
    const { opaques } = replaceEntitiesWithPlaceholdersInSourceXml(xml, new Set());
    expect(opaques[0]?.index).toBe(0);
  });
});

describe('collectEntitiesFromSourceUnitXml', () => {
  test('finds keyed entities and personWrapper keys', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<name type="personWrapper" key="person-1">' +
      '<persName key="person-1">陳</persName>' +
      '</name>' +
      '<roleName key="office-1">卿士</roleName>' +
      '</p>';
    const hits = collectEntitiesFromSourceUnitXml(xml);
    expect(hits.map((h) => h.key).sort()).toEqual(['office-1', 'person-1']);
  });
});

describe('substituteOpaquePlaceholders', () => {
  test('replaces opaque / as:opaque / holding:opaque tokens', () => {
    const map = new Map([
      [0, { index: 0, kind: 'office', surface: '益州刺史' }],
      [1, { index: 1, kind: 'office', surface: '貞陽公' }],
    ]);
    expect(substituteOpaquePlaceholders('made {{as:opaque:0}}.', map)).toBe('made [益州刺史].');
    expect(substituteOpaquePlaceholders('{{holding:opaque:1}} X', map)).toBe('[貞陽公] X');
  });
});

describe('missingPlaceholders', () => {
  test('reports dropped tokens', () => {
    const expected = '{{date:0}}以{{holding:o1}}{{entity:p1}}為{{as:opaque:0}}';
    const actual = '{{date:0}}以{{holding:o1}}{{entity:p1}}為 prefect';
    expect(missingPlaceholders(expected, actual)).toEqual(['{{as:opaque:0}}']);
  });

  test('retry instruction lists missing tokens', () => {
    const msg = buildPlaceholderRetryInstruction(['{{as:opaque:0}}', '{{entity:p1}}']);
    expect(msg).toContain('{{as:opaque:0}}');
    expect(msg).toContain('{{entity:p1}}');
  });
});
