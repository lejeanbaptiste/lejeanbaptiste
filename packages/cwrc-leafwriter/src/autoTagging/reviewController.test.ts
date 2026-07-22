import { handleReviewKey, ReviewController, type DecisionEvent } from './reviewController';
import type { Suggestion } from './types';

const make = (id: string, extra: Partial<Suggestion> = {}): Suggestion => ({
  id,
  source: 'dictionary',
  action: 'add',
  tag: 'persName',
  anchor: {
    documentId: 'doc',
    xpath: '/TEI/p/text()[1]',
    offset: 0,
    surface: id,
    occurrence: 1,
    contextBefore: '',
    contextAfter: '',
    nodeHash: '0',
  },
  status: 'pending',
  ...extra,
});

describe('ReviewController', () => {
  it('walks pending suggestions in document order even when the batch is shuffled', () => {
    const c = new ReviewController([
      make('later', { anchor: { ...make('x').anchor, xpath: '/TEI/text/body/div/p[2]/text()[1]' } }),
      make('earlier', { anchor: { ...make('x').anchor, xpath: '/TEI/text/body/div/p[1]/text()[1]' } }),
    ]);
    expect(c.current()!.id).toBe('earlier');
    c.next();
    expect(c.current()!.id).toBe('later');
  });

  it('walks, decides, and advances to the next pending suggestion', () => {
    const focused: string[] = [];
    const decisions: DecisionEvent[] = [];
    const c = new ReviewController([make('a'), make('b'), make('c')], {
      onFocus: (s) => focused.push(s.id),
      onDecision: (e) => decisions.push(e),
    });

    expect(c.current()!.id).toBe('a');
    c.accept();
    expect(c.current()!.id).toBe('b');
    c.reject();
    expect(c.current()!.id).toBe('c');
    c.accept();

    expect(c.counts()).toMatchObject({ pending: 0, accepted: 2, rejected: 1 });
    expect(decisions.map((d) => `${d.suggestion.id}:${d.decision}`)).toEqual([
      'a:accepted',
      'b:rejected',
      'c:accepted',
    ]);
    expect(focused).toEqual(['a', 'b', 'c']);
  });

  it('wraps around to earlier pending items after deciding the last one', () => {
    const c = new ReviewController([make('a'), make('b')]);
    c.next(); // move to b without deciding a
    c.accept(); // decide b → should wrap to a
    expect(c.current()!.id).toBe('a');
  });

  it('undecide restores pending before apply', () => {
    const c = new ReviewController([make('a'), make('b')]);
    c.accept();
    const [accepted] = c.acceptedVisible();
    c.undecideSuggestion(accepted!);
    expect(c.counts()).toMatchObject({ pending: 2, accepted: 0 });
  });

  it('skips deciding unresolvable suggestions', () => {
    const c = new ReviewController([make('a', { status: 'unresolvable' })]);
    c.accept();
    expect(c.counts()).toMatchObject({ unresolvable: 1, accepted: 0 });
  });

  it('filters by source and confidence', () => {
    const c = new ReviewController([
      make('dict1'),
      make('ai-low', { source: 'ai', confidence: 0.4 }),
      make('ai-high', { source: 'ai', confidence: 0.9 }),
    ]);

    c.setFilters({ sources: new Set(['ai']), minConfidence: 0.5 });
    expect(c.visible().map((s) => s.id)).toEqual(['ai-high']);

    c.setFilters({ sources: new Set(), minConfidence: 0 });
    expect(c.visible()).toHaveLength(3);
  });

  it('confidence filter keeps suggestions without confidence visible', () => {
    const c = new ReviewController([make('dict1'), make('ai', { source: 'ai', confidence: 0.3 })]);
    c.setFilters({ minConfidence: 0.5 });
    expect(c.visible().map((s) => s.id)).toEqual(['dict1']);
  });

  it('acceptAllAbove only touches pending items with confidence at/above threshold', () => {
    const decisions: string[] = [];
    const c = new ReviewController(
      [
        make('dict', {}), // no confidence → untouched
        make('lo', { source: 'ai', confidence: 0.4 }),
        make('hi', { source: 'ai', confidence: 0.95 }),
        make('done', { source: 'ai', confidence: 0.99, status: 'rejected' }),
      ],
      { onDecision: (e) => decisions.push(e.suggestion.id) },
    );

    c.acceptAllAbove(0.9);
    expect(c.counts()).toMatchObject({ accepted: 1, pending: 2, rejected: 1 });
    expect(decisions).toEqual(['hi']);
  });

  it('takeAccepted supports partial apply: accepted leave, pending remain', () => {
    const c = new ReviewController([make('a'), make('b'), make('c')]);
    c.accept(); // a
    const taken = c.takeAccepted();
    expect(taken.map((s) => s.id)).toEqual(['a']);
    expect(c.visible().map((s) => s.id)).toEqual(['b', 'c']);
    expect(c.current()).not.toBeNull();
  });

  it('takeAllExceptRejected accepts pending, keeps rejected, and returns all non-rejected', () => {
    const decisions: string[] = [];
    const c = new ReviewController([make('a'), make('b'), make('c'), make('d')], {
      onDecision: (e) => decisions.push(`${e.suggestion.id}:${e.decision}`),
    });
    c.accept(); // a
    c.reject(); // b
    const taken = c.takeAllExceptRejected();
    expect(taken.map((s) => s.id).sort()).toEqual(['a', 'c', 'd'].sort());
    expect(c.visible().map((s) => s.id)).toEqual(['b']);
    expect(c.counts()).toMatchObject({ rejected: 1, pending: 0, accepted: 0 });
    expect(decisions).toContain('c:accepted');
    expect(decisions).toContain('d:accepted');
  });

  it('acceptAllIdenticalStrings accepts every pending match for surface and tag', () => {
    const anchor = make('x').anchor;
    const c = new ReviewController([
      make('a1', { anchor: { ...anchor, surface: '張衡' } }),
      make('a2', { anchor: { ...anchor, surface: '張衡' } }),
      make('b', { anchor: { ...anchor, surface: '洛陽' }, tag: 'placeName' }),
    ]);
    c.acceptAllIdenticalStrings();
    expect(c.counts()).toMatchObject({ accepted: 2, pending: 1 });
  });

  it('rejectAllIdenticalStrings rejects every pending match for surface and tag', () => {
    const anchor = make('x').anchor;
    const c = new ReviewController([
      make('a1', { anchor: { ...anchor, surface: '張衡' } }),
      make('a2', { anchor: { ...anchor, surface: '張衡' } }),
      make('b', { anchor: { ...anchor, surface: '洛陽' }, tag: 'placeName' }),
    ]);
    c.rejectAllIdenticalStrings();
    expect(c.counts()).toMatchObject({ rejected: 2, pending: 1 });
  });

  it('changeDecision flips accepted and rejected outcomes', () => {
    const decisions: string[] = [];
    const c = new ReviewController([make('a'), make('b')], {
      onDecision: (e) => decisions.push(`${e.suggestion.id}:${e.decision}`),
    });
    c.accept();
    const accepted = c.acceptedVisible()[0]!;
    c.changeDecision(accepted, 'rejected');
    expect(accepted.status).toBe('rejected');
    expect(decisions).toContain('a:accepted');
    expect(decisions).toContain('a:rejected');
  });

  it('handles an empty batch without a cursor', () => {
    const c = new ReviewController([]);
    expect(c.current()).toBeNull();
    c.next();
    c.accept();
    expect(c.counts().total).toBe(0);
  });

  describe('same-span alternatives (one string, several tags)', () => {
    const altPair = () => {
      const anchor = {
        ...make('x').anchor,
        surface: '高祖',
        offset: 5,
        xpath: '/TEI/text/body/div/p[1]/text()[1]',
      };
      return [
        make('as-pers', { tag: 'persName', anchor: { ...anchor } }),
        make('as-title', { tag: 'title', anchor: { ...anchor } }),
        make('other', {
          anchor: { ...make('x').anchor, surface: '洛陽', xpath: '/TEI/text/body/div/p[2]/text()[1]' },
          tag: 'placeName',
        }),
      ];
    };

    it('accepting one alternative rejects the other', () => {
      const decisions: string[] = [];
      const c = new ReviewController(altPair(), {
        onDecision: (e) => decisions.push(`${e.suggestion.id}:${e.decision}`),
      });
      c.accept(); // accepts as-pers
      expect(c.counts()).toMatchObject({ accepted: 1, rejected: 1, pending: 1 });
      expect(decisions).toContain('as-pers:accepted');
      expect(decisions).toContain('as-title:rejected');
    });

    it('rejects the whole pair together — there is one reject decision for the group', () => {
      const decisions: string[] = [];
      const c = new ReviewController(altPair(), {
        onDecision: (e) => decisions.push(`${e.suggestion.id}:${e.decision}`),
      });
      c.reject();
      expect(c.counts()).toMatchObject({ rejected: 2, pending: 1 });
      expect(decisions).toEqual(
        expect.arrayContaining(['as-pers:rejected', 'as-title:rejected']),
      );
    });

    it('j/k treat the alternative pair as a single navigation stop', () => {
      const c = new ReviewController(altPair());
      expect(c.pendingGroups()).toHaveLength(2); // the pair + 'other'
      expect(c.pendingGroups()[0]!.suggestions.map((s) => s.id)).toEqual(['as-pers', 'as-title']);
      c.next();
      expect(c.current()!.id).toBe('other');
      c.previous();
      expect(c.current()!.id).toBe('as-pers'); // default-selected alternative
    });

    it('cycleAlternative and selectAlternative change which tag Enter would accept', () => {
      const c = new ReviewController(altPair());
      expect(c.current()!.id).toBe('as-pers');
      c.cycleAlternative();
      expect(c.current()!.id).toBe('as-title');
      c.cycleAlternative();
      expect(c.current()!.id).toBe('as-pers');

      const title = c.pendingGroups()[0]!.suggestions.find((s) => s.id === 'as-title')!;
      c.selectAlternative(title);
      expect(c.current()!.id).toBe('as-title');
      c.accept();
      expect(c.accepted().map((s) => s.id)).toEqual(['as-title']);
      expect(c.rejectedVisible().map((s) => s.id)).toEqual(['as-pers']);
    });

    it('flipping a rejected alternative to accepted dethrones the earlier winner', () => {
      const c = new ReviewController(altPair());
      c.accept(); // as-pers wins, as-title auto-rejected
      const title = c.rejectedVisible().find((s) => s.id === 'as-title')!;
      c.changeDecision(title, 'accepted');
      expect(title.status).toBe('accepted');
      expect(c.accepted().map((s) => s.id)).toEqual(['as-title']);
      expect(c.rejectedVisible().map((s) => s.id)).toContain('as-pers');
    });

    it('takeAllExceptRejected lets the first alternative win instead of applying both', () => {
      const c = new ReviewController(altPair());
      const taken = c.takeAllExceptRejected();
      expect(taken.map((s) => s.id)).toEqual(['as-pers', 'other']);
      expect(c.rejectedVisible().map((s) => s.id)).toEqual(['as-title']);
    });

    it('acceptAllIdenticalStrings rejects alternatives of each accepted match', () => {
      const c = new ReviewController(altPair());
      c.acceptAllIdenticalStrings(); // current is as-pers (高祖/persName)
      expect(c.accepted().map((s) => s.id)).toEqual(['as-pers']);
      expect(c.rejectedVisible().map((s) => s.id)).toEqual(['as-title']);
    });
  });
});

describe('handleReviewKey', () => {
  it('maps the shared keyboard model to commands', () => {
    const c = new ReviewController([make('a'), make('b')]);
    expect(handleReviewKey(c, 'j')).toBe(true);
    expect(c.current()!.id).toBe('b');
    expect(handleReviewKey(c, 'ArrowUp')).toBe(true);
    expect(c.current()!.id).toBe('a');
    expect(handleReviewKey(c, 'Enter')).toBe(true);
    expect(c.counts().accepted).toBe(1);
    expect(handleReviewKey(c, 'Backspace')).toBe(true);
    expect(c.counts().rejected).toBe(1);
    expect(handleReviewKey(c, 'q')).toBe(false);
  });

  it('Space cycles the selected alternative within a group', () => {
    const anchor = make('x').anchor;
    const c = new ReviewController([
      make('pers', { tag: 'persName', anchor: { ...anchor, surface: '高祖' } }),
      make('title', { tag: 'title', anchor: { ...anchor, surface: '高祖' } }),
    ]);
    expect(c.current()!.id).toBe('pers');
    expect(handleReviewKey(c, ' ')).toBe(true);
    expect(c.current()!.id).toBe('title');
  });

  it('Shift+Enter accepts all pending items with the same surface and tag', () => {
    const anchor = make('x').anchor;
    const c = new ReviewController([
      make('one', { anchor: { ...anchor, surface: '同' } }),
      make('two', { anchor: { ...anchor, surface: '同' } }),
      make('other', { anchor: { ...anchor, surface: '異' } }),
    ]);
    expect(handleReviewKey(c, 'Enter', { shift: true })).toBe(true);
    expect(c.counts()).toMatchObject({ accepted: 2, pending: 1 });
  });

  it('Shift+Backspace rejects all pending items with the same surface and tag', () => {
    const anchor = make('x').anchor;
    const c = new ReviewController([
      make('one', { anchor: { ...anchor, surface: '同' } }),
      make('two', { anchor: { ...anchor, surface: '同' } }),
      make('other', { anchor: { ...anchor, surface: '異' } }),
    ]);
    expect(handleReviewKey(c, 'Backspace', { shift: true })).toBe(true);
    expect(c.counts()).toMatchObject({ rejected: 2, pending: 1 });
  });
});
