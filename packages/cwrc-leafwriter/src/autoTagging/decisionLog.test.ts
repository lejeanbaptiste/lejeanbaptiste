import {
  appendRecords,
  DecisionLogBuffer,
  deriveCounts,
  parseLog,
  recordFromDecision,
  type DecisionRecord,
} from './decisionLog';
import type { DecisionEvent } from './reviewController';
import type { Suggestion } from './types';

const suggestion = (over: Partial<Suggestion> = {}): Suggestion => ({
  id: 's1',
  source: 'dictionary',
  action: 'add',
  tag: 'persName',
  anchor: {
    documentId: 'chapter1.xml',
    xpath: '/TEI/p/text()[1]',
    offset: 0,
    surface: '張衡',
    occurrence: 2,
    contextBefore: '',
    contextAfter: '',
    nodeHash: 'abc123',
  },
  status: 'pending',
  ...over,
});

describe('recordFromDecision', () => {
  it('maps a review decision to a log record', () => {
    const event: DecisionEvent = { suggestion: suggestion(), decision: 'accepted' };
    const record = recordFromDecision(event, '2026-07-03T12:00:00Z');
    expect(record).toEqual({
      when: '2026-07-03T12:00:00Z',
      documentId: 'chapter1.xml',
      surface: '張衡',
      tag: 'persName',
      action: 'accepted',
      source: 'dictionary',
      scope: 'occurrence',
      occurrence: 2,
      nodeHash: 'abc123',
    });
  });
});

describe('JSONL round-trip', () => {
  it('formats, appends, and re-parses records', () => {
    const records: DecisionRecord[] = [
      recordFromDecision({ suggestion: suggestion(), decision: 'accepted' }),
      recordFromDecision({ suggestion: suggestion({ id: 's2' }), decision: 'rejected' }),
    ];
    const body = appendRecords('', records);
    expect(body.endsWith('\n')).toBe(true);
    expect(parseLog(body)).toHaveLength(2);
  });

  it('appends to an existing body without dropping earlier lines', () => {
    const first = appendRecords('', [recordFromDecision({ suggestion: suggestion(), decision: 'accepted' })]);
    const second = appendRecords(first, [
      recordFromDecision({ suggestion: suggestion(), decision: 'rejected' }),
    ]);
    expect(parseLog(second)).toHaveLength(2);
  });

  it('skips blank and corrupt lines when parsing', () => {
    const body = '{"action":"accepted"}\n\nnot json\n{"action":"rejected"}\n';
    expect(parseLog(body)).toHaveLength(2);
  });
});

describe('deriveCounts', () => {
  it('counts by action', () => {
    const records = parseLog(
      appendRecords('', [
        recordFromDecision({ suggestion: suggestion(), decision: 'accepted' }),
        recordFromDecision({ suggestion: suggestion(), decision: 'accepted' }),
        recordFromDecision({ suggestion: suggestion(), decision: 'rejected' }),
      ]),
    );
    expect(deriveCounts(records)).toMatchObject({ accepted: 2, rejected: 1 });
  });
});

describe('DecisionLogBuffer', () => {
  it('buffers onDecision events and flushes to a JSONL body', () => {
    const buffer = new DecisionLogBuffer();
    buffer.add({ suggestion: suggestion(), decision: 'accepted' });
    buffer.add({ suggestion: suggestion({ id: 's2' }), decision: 'rejected' });
    expect(buffer.length).toBe(2);

    const body = buffer.flush('');
    expect(parseLog(body)).toHaveLength(2);
    // buffer clears after flush
    expect(buffer.length).toBe(0);
  });

  it('accepts direct resolution records (auto-resolve path)', () => {
    const buffer = new DecisionLogBuffer();
    buffer.addRecord({
      when: '2026-07-03T00:00:00Z',
      documentId: 'a.xml',
      surface: '張衡',
      tag: 'persName',
      action: 'auto-resolved',
      source: 'disambiguation',
      entityId: 'person-000001',
      scope: 'occurrence',
    });
    const body = buffer.flush();
    expect(parseLog(body)[0]?.action).toBe('auto-resolved');
  });
});
