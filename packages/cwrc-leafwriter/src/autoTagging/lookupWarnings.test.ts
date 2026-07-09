import { appendResolution, parseWarnings, warningKey } from './lookupWarnings';
import type { LookupWarning } from './lookupWarnings';

const warning = (overrides: Partial<LookupWarning> = {}): LookupWarning => ({
  when: '2026-07-09T10:00:00.000Z',
  kind: 'concordance-conflict',
  entityIds: ['person-1', 'person-2'],
  authority: 'CBDB',
  value: '12345',
  detail: 'lookup matched multiple entities',
  ...overrides,
});

describe('parseWarnings', () => {
  it('parses warning lines', () => {
    const body = `${JSON.stringify(warning())}\n`;
    expect(parseWarnings(body)).toEqual([warning()]);
  });

  it('skips blank and corrupt lines', () => {
    const body = [
      '',
      'not json {{{',
      JSON.stringify(warning()),
      '   ',
      '{"half": true',
    ].join('\n');
    expect(parseWarnings(body)).toEqual([warning()]);
  });

  it('skips well-formed JSON that is not a warning', () => {
    const body = [
      JSON.stringify({ kind: 'idno-conflict' }), // missing fields
      JSON.stringify({ ...warning(), kind: 'something-else' }),
      JSON.stringify({ ...warning(), entityIds: 'person-1' }),
      JSON.stringify(warning({ kind: 'idno-conflict' })),
    ].join('\n');
    expect(parseWarnings(body)).toEqual([warning({ kind: 'idno-conflict' })]);
  });

  it('collapses duplicate warnings with the same key', () => {
    const body = [JSON.stringify(warning()), JSON.stringify(warning())].join('\n');
    expect(parseWarnings(body)).toHaveLength(1);
  });

  it('filters out warnings closed by a resolution marker', () => {
    const kept = warning({ value: '99999' });
    let body = [JSON.stringify(warning()), JSON.stringify(kept)].join('\n') + '\n';
    body = appendResolution(body, warning());
    expect(parseWarnings(body)).toEqual([kept]);
  });

  it('ignores resolution markers for unknown keys', () => {
    const body = appendResolution(JSON.stringify(warning()) + '\n', warning({ value: 'other' }));
    expect(parseWarnings(body)).toEqual([warning()]);
  });
});

describe('appendResolution', () => {
  it('appends a marker to an empty log', () => {
    const body = appendResolution('', warning(), '2026-07-09T11:00:00.000Z');
    expect(body).toBe(
      JSON.stringify({
        when: '2026-07-09T11:00:00.000Z',
        kind: 'resolved',
        resolves: warningKey(warning()),
      }) + '\n',
    );
  });

  it('handles a log body missing its trailing newline', () => {
    const body = appendResolution(JSON.stringify(warning()), warning());
    expect(body.split('\n').filter(Boolean)).toHaveLength(2);
    expect(parseWarnings(body)).toEqual([]);
  });
});

describe('warningKey', () => {
  it('differs across kind, authority, and value', () => {
    const base = warningKey(warning());
    expect(warningKey(warning({ kind: 'idno-conflict' }))).not.toBe(base);
    expect(warningKey(warning({ authority: 'VIAF' }))).not.toBe(base);
    expect(warningKey(warning({ value: '54321' }))).not.toBe(base);
  });
});
