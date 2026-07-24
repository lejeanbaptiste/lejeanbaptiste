import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
import { makeOrder } from './entityOrders';
import {
  makeDeleteSuggestion,
  makeMergeSuggestion,
  makeMergeSuggestionResolution,
  pendingDeleteSuggestions,
  pendingMergeSuggestions,
  type CentralMergeSuggestion,
  type MergeSuggestionResolution,
} from './centralMergeSuggestions';

const CEDB_ID = 'cedb-1';

const setupCedb = () => {
  const doc = parseEntities(createEntitiesScaffold(CEDB_ID));
  const a = addEntity(doc, 'work', { name: '南齊書 (A)' }).id;
  const b = addEntity(doc, 'work', { name: '南齊書 (B)' }).id;
  return { doc, a, b };
};

describe('pendingMergeSuggestions', () => {
  it('surfaces a fresh suggestion naming both still-existing central ids', () => {
    const { doc, a, b } = setupCedb();
    const suggestion = makeMergeSuggestion('pedb-1', [a, b]);

    const pending = pendingMergeSuggestions([suggestion], [], [], CEDB_ID, doc);
    expect(pending).toEqual([{ id: suggestion.id, when: suggestion.when, centralIds: [a, b] }]);
  });

  it('drops a suggestion once it has any resolution (merged or ignored)', () => {
    const { doc, a, b } = setupCedb();
    const suggestion = makeMergeSuggestion('pedb-1', [a, b]);
    const resolution = makeMergeSuggestionResolution(suggestion.id, 'ignored');

    expect(pendingMergeSuggestions([suggestion], [resolution], [], CEDB_ID, doc)).toEqual([]);
  });

  it('drops a suggestion already satisfied by a regular Absorb order', () => {
    const { doc, a, b } = setupCedb();
    const suggestion = makeMergeSuggestion('pedb-1', [a, b]);
    const order = makeOrder(CEDB_ID, { [a]: b });

    expect(pendingMergeSuggestions([suggestion], [], [order], CEDB_ID, doc)).toEqual([]);
  });

  it('resolves through an order chain to the current surviving pair', () => {
    const { doc, a, b } = setupCedb();
    const c = addEntity(doc, 'work', { name: '南齊書 (C)' }).id;
    const suggestion = makeMergeSuggestion('pedb-1', [a, b]);
    // b was itself later merged into c by an ordinary Absorb.
    const order = makeOrder(CEDB_ID, { [b]: c });

    const pending = pendingMergeSuggestions([suggestion], [], [order], CEDB_ID, doc);
    expect(pending).toEqual([{ id: suggestion.id, when: suggestion.when, centralIds: [a, c] }]);
  });

  it('drops a suggestion when one side was deleted outright (no survivor)', () => {
    const { doc, a, b } = setupCedb();
    const suggestion = makeMergeSuggestion('pedb-1', [a, b]);
    const order = makeOrder(CEDB_ID, { [b]: null });

    expect(pendingMergeSuggestions([suggestion], [], [order], CEDB_ID, doc)).toEqual([]);
  });

  it('drops a suggestion whose id no longer exists in the central database', () => {
    const { doc, a } = setupCedb();
    const suggestion = makeMergeSuggestion('pedb-1', [a, 'work-does-not-exist']);

    expect(pendingMergeSuggestions([suggestion], [], [], CEDB_ID, doc)).toEqual([]);
  });

  it('collapses two suggestions that resolve to the same unordered pair', () => {
    const { doc, a, b } = setupCedb();
    const first = makeMergeSuggestion('pedb-1', [a, b], '2026-01-01T00:00:00.000Z');
    const second = makeMergeSuggestion('pedb-2', [b, a], '2026-01-02T00:00:00.000Z');

    const pending = pendingMergeSuggestions([first, second], [], [], CEDB_ID, doc);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe(first.id);
  });

  it('ignores orders recorded against a different database fingerprint', () => {
    const { doc, a, b } = setupCedb();
    const suggestion = makeMergeSuggestion('pedb-1', [a, b]);
    const foreignOrder = makeOrder('cedb-OTHER', { [a]: b });

    const pending = pendingMergeSuggestions([suggestion], [], [foreignOrder], CEDB_ID, doc);
    expect(pending).toEqual([{ id: suggestion.id, when: suggestion.when, centralIds: [a, b] }]);
  });

  it('is empty with no suggestions', () => {
    const { doc } = setupCedb();
    expect(pendingMergeSuggestions([], [], [], CEDB_ID, doc)).toEqual([]);
  });

  it('ignores delete-kind suggestions mixed into the same log', () => {
    const { doc, a } = setupCedb();
    const del = makeDeleteSuggestion('pedb-1', a);
    expect(pendingMergeSuggestions([del], [], [], CEDB_ID, doc)).toEqual([]);
  });
});

describe('pendingDeleteSuggestions', () => {
  it('surfaces a fresh delete suggestion naming the still-existing central id', () => {
    const { doc, a } = setupCedb();
    const suggestion = makeDeleteSuggestion('pedb-1', a);

    const pending = pendingDeleteSuggestions([suggestion], [], [], CEDB_ID, doc);
    expect(pending).toEqual([{ id: suggestion.id, when: suggestion.when, centralId: a }]);
  });

  it('drops a delete suggestion once it has any resolution', () => {
    const { doc, a } = setupCedb();
    const suggestion = makeDeleteSuggestion('pedb-1', a);
    const resolution = makeMergeSuggestionResolution(suggestion.id, 'ignored');

    expect(pendingDeleteSuggestions([suggestion], [resolution], [], CEDB_ID, doc)).toEqual([]);
  });

  it('drops a delete suggestion once the central entity was actually deleted', () => {
    const { doc, a } = setupCedb();
    const suggestion = makeDeleteSuggestion('pedb-1', a);
    const order = makeOrder(CEDB_ID, { [a]: null });

    expect(pendingDeleteSuggestions([suggestion], [], [order], CEDB_ID, doc)).toEqual([]);
  });

  it('resolves through a later merge to the surviving id', () => {
    const { doc, a, b } = setupCedb();
    const suggestion = makeDeleteSuggestion('pedb-1', a);
    const order = makeOrder(CEDB_ID, { [a]: b });

    const pending = pendingDeleteSuggestions([suggestion], [], [order], CEDB_ID, doc);
    expect(pending).toEqual([{ id: suggestion.id, when: suggestion.when, centralId: b }]);
  });

  it('drops a delete suggestion whose id no longer exists in the central database', () => {
    const { doc } = setupCedb();
    const suggestion = makeDeleteSuggestion('pedb-1', 'work-does-not-exist');

    expect(pendingDeleteSuggestions([suggestion], [], [], CEDB_ID, doc)).toEqual([]);
  });

  it('collapses two delete suggestions that resolve to the same central id', () => {
    const { doc, a } = setupCedb();
    const first = makeDeleteSuggestion('pedb-1', a, '2026-01-01T00:00:00.000Z');
    const second = makeDeleteSuggestion('pedb-2', a, '2026-01-02T00:00:00.000Z');

    const pending = pendingDeleteSuggestions([first, second], [], [], CEDB_ID, doc);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe(first.id);
  });

  it('ignores merge-kind suggestions mixed into the same log', () => {
    const { doc, a, b } = setupCedb();
    const merge = makeMergeSuggestion('pedb-1', [a, b]);
    expect(pendingDeleteSuggestions([merge], [], [], CEDB_ID, doc)).toEqual([]);
  });

  it('is empty with no suggestions', () => {
    const { doc } = setupCedb();
    expect(pendingDeleteSuggestions([], [], [], CEDB_ID, doc)).toEqual([]);
  });
});

describe('makeMergeSuggestion / makeMergeSuggestionResolution', () => {
  it('mints unique ids', () => {
    const a: CentralMergeSuggestion = makeMergeSuggestion('pedb-1', ['x', 'y']);
    const b: CentralMergeSuggestion = makeMergeSuggestion('pedb-1', ['x', 'y']);
    expect(a.id).not.toBe(b.id);
  });

  it('references the suggestion it resolves', () => {
    const suggestion = makeMergeSuggestion('pedb-1', ['x', 'y']);
    const resolution: MergeSuggestionResolution = makeMergeSuggestionResolution(
      suggestion.id,
      'merged',
    );
    expect(resolution.suggestionId).toBe(suggestion.id);
    expect(resolution.action).toBe('merged');
  });
});
