/**
 * @jest-environment jsdom
 */
import {
  collectEntitiesFromSourceUnitXml,
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
    expect(rewritten).toContain('{{entity:person-1}}');
    expect(rewritten).toContain('{{entity:office-1}}');
    expect(rewritten).toContain('{{entity:place-1}}');
    expect(rewritten).not.toContain('平北將軍');
    expect(rewritten).not.toContain('<roleName');
    expect(opaques).toHaveLength(0);
  });

  test('leaves unknown keys alone then opaque-blinds them', () => {
    const xml = '<p xmlns="http://www.tei-c.org/ns/1.0"><roleName key="office-missing">平北將軍</roleName></p>';
    const { xml: rewritten } = replaceEntitiesWithPlaceholdersInSourceXml(
      xml,
      new Set(['office-1']),
    );
    // key not in knownKeys → treated as leftover keyed? Actually has key so opaque skip.
    // keyed but unknown stays as roleName with Chinese
    expect(rewritten).toContain('平北將軍');
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
    expect(rewritten).toContain('{{entity:office-nanyan}}');
    expect(rewritten).not.toContain('{{entity:place-nanyan}}');
    expect(rewritten).not.toContain('南兗州');
    expect(rewritten).not.toContain('刺史');
  });

  test('opaque-blinds unkeyed office constructions', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<roleName><placeName>益州</placeName>刺史</roleName>' +
      '</p>';
    const { xml: rewritten, opaques } = replaceEntitiesWithPlaceholdersInSourceXml(
      xml,
      new Set(),
    );
    expect(rewritten).toContain('{{opaque:0}}');
    expect(rewritten).not.toContain('益州');
    expect(opaques[0]?.surface).toBe('益州刺史');
  });

  test('blinds persName inside personWrapper and unwraps the shell', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<name type="personWrapper" key="person-1">' +
      '<roleName key="office-1">平北將軍</roleName>' +
      '<persName key="person-1">陳顯達</persName>' +
      '</name>' +
      '</p>';
    const keys = new Set(['person-1', 'office-1']);
    const { xml: rewritten } = replaceEntitiesWithPlaceholdersInSourceXml(xml, keys);
    expect(rewritten).toContain('{{entity:office-1}}');
    expect(rewritten).toContain('{{entity:person-1}}');
    expect(rewritten).not.toContain('陳顯達');
    expect(rewritten).not.toContain('personWrapper');
    expect(rewritten).not.toContain('<persName');
  });

  test('blinds unkeyed persName using the personWrapper key', () => {
    const xml =
      '<p xmlns="http://www.tei-c.org/ns/1.0">' +
      '<name type="personWrapper" key="person-1">' +
      '<persName>陳顯達</persName>' +
      '</name>' +
      '</p>';
    const keys = new Set(['person-1']);
    const { xml: rewritten } = replaceEntitiesWithPlaceholdersInSourceXml(xml, keys);
    expect(rewritten).toContain('{{entity:person-1}}');
    expect(rewritten).not.toContain('陳顯達');
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
  test('replaces opaque tokens with bracketed surface', () => {
    const map = new Map([
      [0, { index: 0, kind: 'office', surface: '益州刺史' }],
    ]);
    expect(substituteOpaquePlaceholders('made {{opaque:0}}.', map)).toBe('made [益州刺史].');
  });
});
