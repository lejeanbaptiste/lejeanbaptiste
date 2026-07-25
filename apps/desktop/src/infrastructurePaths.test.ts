import {
  isCorpusExcludedPath,
  isEntityDatabasePath,
  isInfrastructureDirName,
  isInfrastructurePath,
} from './infrastructurePaths';

describe('isInfrastructurePath', () => {
  it('flags files under the reserved /.ljb/ directory', () => {
    expect(isInfrastructurePath('/proj/.ljb/entity-decisions.jsonl')).toBe(true);
    expect(isInfrastructurePath('C:\\proj\\.ljb\\authority-cache/foo.json')).toBe(true);
  });

  it('flags files under /.ljb-time-machine/', () => {
    expect(
      isInfrastructurePath('/proj/.ljb-time-machine/snapshots/2026-07-24/files/bios/foo.xml'),
    ).toBe(true);
    expect(isInfrastructureDirName('.ljb-time-machine')).toBe(true);
  });

  it('leaves normal corpus files alone', () => {
    expect(isInfrastructurePath('/proj/chapter1.xml')).toBe(false);
    expect(isInfrastructurePath('/proj/schema/tei_all.rng')).toBe(false);
    expect(isInfrastructurePath('/proj/my.ljb.notes.xml')).toBe(false);
  });
});

describe('isEntityDatabasePath', () => {
  it('flags project-root entities.xml only', () => {
    expect(isEntityDatabasePath('/proj/entities.xml', '/proj')).toBe(true);
    expect(isEntityDatabasePath('/proj/sub/entities.xml', '/proj')).toBe(false);
    expect(isEntityDatabasePath('/corpus/entities.xml', '/proj')).toBe(false);
  });
});

describe('isCorpusExcludedPath', () => {
  it('combines infra and entity database exclusions', () => {
    expect(isCorpusExcludedPath('/proj/.ljb/foo.json')).toBe(true);
    expect(isCorpusExcludedPath('/proj/.ljb-time-machine/snapshots/x/files/a.xml')).toBe(true);
    expect(isCorpusExcludedPath('/proj/entities.xml', '/proj')).toBe(true);
    expect(isCorpusExcludedPath('/proj/chapter1.xml', '/proj')).toBe(false);
  });
});
