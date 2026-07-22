import { stampProjectDatabase } from './corpusStamp';
import { hasOrphans, orphanPurgeRemap, sweepOrphans, type CorpusFile } from './orphanSweep';

const doc = (body: string, stampWith?: string): string => {
  const base = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>c</title></titleStmt>
  <publicationStmt><p>x</p></publicationStmt><sourceDesc><p>x</p></sourceDesc></fileDesc></teiHeader>
  <text><body>${body}</body></text>
</TEI>`;
  return stampWith ? stampProjectDatabase(base, stampWith).xml : base;
};

describe('sweepOrphans', () => {
  it('reports keys absent from the PEDB as genuine orphans', () => {
    const files: CorpusFile[] = [
      { path: 'a.xml', xml: doc('<persName key="person-1">A</persName><persName key="person-2">B</persName>', 'pedb-1') },
    ];
    const report = sweepOrphans(files, new Set(['person-1']), 'pedb-1');
    expect(report.orphanFiles).toEqual([{ path: 'a.xml', orphanKeys: ['person-2'] }]);
    expect(report.strayFiles).toHaveLength(0);
    expect(report.orphanKeyCount).toBe(1);
  });

  it('treats a file stamped for a different PEDB as stray, never orphan', () => {
    const files: CorpusFile[] = [
      { path: 'copied.xml', xml: doc('<persName key="person-9">Z</persName>', 'other-pedb') },
    ];
    const report = sweepOrphans(files, new Set(['person-1']), 'pedb-1');
    expect(report.orphanFiles).toHaveLength(0);
    expect(report.strayFiles).toEqual([
      { path: 'copied.xml', stamp: 'other-pedb', orphanKeys: ['person-9'] },
    ]);
    expect(report.strayKeyCount).toBe(1);
  });

  it('treats an unstamped file with a matching-db assumption as orphan (rollback case)', () => {
    const files: CorpusFile[] = [{ path: 'legacy.xml', xml: doc('<placeName key="place-x">L</placeName>') }];
    const report = sweepOrphans(files, new Set(['place-y']), 'pedb-1');
    expect(report.orphanFiles).toEqual([{ path: 'legacy.xml', orphanKeys: ['place-x'] }]);
  });

  it('ignores files whose keys all resolve', () => {
    const files: CorpusFile[] = [
      { path: 'ok.xml', xml: doc('<persName key="person-1">A</persName>', 'pedb-1') },
    ];
    const report = sweepOrphans(files, new Set(['person-1']), 'pedb-1');
    expect(hasOrphans(report)).toBe(false);
  });

  it('builds a purge remap for genuine orphans only', () => {
    const files: CorpusFile[] = [
      { path: 'a.xml', xml: doc('<persName key="person-2">B</persName>', 'pedb-1') },
      { path: 'stray.xml', xml: doc('<persName key="person-9">Z</persName>', 'other-pedb') },
    ];
    const report = sweepOrphans(files, new Set(['person-1']), 'pedb-1');
    expect(orphanPurgeRemap(report)).toEqual({ 'person-2': null });
  });
});
