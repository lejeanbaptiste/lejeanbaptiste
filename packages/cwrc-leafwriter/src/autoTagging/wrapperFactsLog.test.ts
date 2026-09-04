import {
  appendWrapperFactRecords,
  formatWrapperFact,
  parseWrapperFacts,
  type WrapperFactRecord,
} from './wrapperFactsLog';

const fact = (over: Partial<WrapperFactRecord> = {}): WrapperFactRecord => ({
  when: '2026-01-01T00:00:00.000Z',
  query: { persName: '休仁', dynasty: '宋', nobleTitle: { fief: '建安', roleName: '王' } },
  entityId: 'person-1',
  ...over,
});

describe('wrapperFactsLog', () => {
  it('round-trips a single record through format/parse', () => {
    const record = fact();
    expect(parseWrapperFacts(formatWrapperFact(record) + '\n')).toEqual([record]);
  });

  it('appends onto an existing non-empty body with exactly one newline between', () => {
    const first = appendWrapperFactRecords('', [fact({ entityId: 'p1' })]);
    const second = appendWrapperFactRecords(first, [fact({ entityId: 'p2' })]);
    expect(parseWrapperFacts(second).map((r) => r.entityId)).toEqual(['p1', 'p2']);
    expect(second.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('appending nothing returns the body unchanged', () => {
    const body = appendWrapperFactRecords('existing\n', []);
    expect(body).toBe('existing\n');
  });

  it('skips blank and corrupt lines when parsing', () => {
    const body = `${formatWrapperFact(fact())}\n\nnot json\n{"query":{}}\n`;
    expect(parseWrapperFacts(body)).toHaveLength(1);
  });

  it('drops a parsed record missing persName or entityId', () => {
    const body = `${JSON.stringify({ when: 'x', query: {}, entityId: 'p1' })}\n${JSON.stringify({
      when: 'x',
      query: { persName: '範' },
    })}\n`;
    expect(parseWrapperFacts(body)).toHaveLength(0);
  });
});
