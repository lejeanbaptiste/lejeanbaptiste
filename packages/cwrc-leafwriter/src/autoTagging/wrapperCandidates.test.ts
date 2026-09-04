import { groupWrapperCandidateSuggestions } from './wrapperCandidates';
import type { Anchor, Suggestion } from './types';

const XPATH = '/TEI/text/body/div[1]/p[1]/text()[1]';

let counter = 0;

/** Builds one pending 'add' suggestion at [offset, offset+surface.length) on the shared test text node. */
function comp(
  tag: string,
  surface: string,
  offset: number,
  extra: Partial<Suggestion> = {},
): Suggestion {
  const anchor: Anchor = {
    documentId: 'doc',
    xpath: XPATH,
    offset,
    surface,
    occurrence: 1,
    contextBefore: '',
    contextAfter: '',
    nodeHash: 'hash',
  };
  return {
    id: `s${counter++}`,
    source: 'authority',
    sourceDetail: 'TEST',
    action: 'add',
    tag,
    anchor,
    status: 'pending',
    ...extra,
  };
}

beforeEach(() => {
  counter = 0;
});

describe('groupWrapperCandidateSuggestions', () => {
  it('groups a fully contiguous roleName + persName run', () => {
    // 刺史(0-2)範(2-3), zero gap.
    const roleName = comp('roleName', '刺史', 0);
    const persName = comp('persName', '範', 2);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([roleName, persName]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toEqual([roleName, persName]);
    expect(groups[0]!.suggestion).toMatchObject({
      action: 'add-compound',
      tag: 'name',
      attributes: { type: 'personWrapper', cert: 'unknown' },
      innerXml: '<roleName>刺史</roleName><persName>範</persName>',
    });
    expect(groups[0]!.suggestion.anchor.surface).toBe('刺史範');
    expect(groups[0]!.suggestion.compoundMembers).toEqual([roleName, persName]);
    expect(ungrouped).toHaveLength(0);
  });

  it('groups every leading slot present, in canonical order', () => {
    const nationality = comp('nationality', '晉', 0);
    const roleName = comp('roleName', '刺史', 1);
    const nobleTitle = comp('nobleTitle', '鄱陽王', 3, {
      innerXml: '<placeName>鄱陽</placeName><roleName>王</roleName>',
    });
    const placeName = comp('placeName', '陳郡', 6);
    const persName = comp('persName', '範', 8);
    const { groups } = groupWrapperCandidateSuggestions([
      nationality,
      roleName,
      nobleTitle,
      placeName,
      persName,
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.map((s) => s.tag)).toEqual([
      'nationality',
      'roleName',
      'nobleTitle',
      'placeName',
      'persName',
    ]);
    expect(groups[0]!.suggestion.innerXml).toBe(
      '<nationality>晉</nationality><roleName>刺史</roleName>' +
        '<nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>' +
        '<placeName>陳郡</placeName><persName>範</persName>',
    );
  });

  it('leaves a lone persName with no other component ungrouped', () => {
    const persName = comp('persName', '範', 0);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([persName]);

    expect(groups).toHaveLength(0);
    expect(ungrouped).toEqual([persName]);
  });

  it('does not group across a gap — adjacency alone is not enough, only exact contiguity', () => {
    // 刺史 at [0,2), then a one-character gap (e.g. punctuation not itself a
    // suggestion), then 範 starting at offset 3 instead of 2.
    const roleName = comp('roleName', '刺史', 0);
    const persName = comp('persName', '範', 3);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([roleName, persName]);

    expect(groups).toHaveLength(0);
    expect(ungrouped).toEqual([roleName, persName]);
  });

  it('stops a run at the first out-of-order component and leaves it ungrouped', () => {
    // placeName (origin) then roleName is backwards — roleName must precede
    // placeName. The run must stop at roleName, and 陳郡 stays ungrouped.
    const placeName = comp('placeName', '陳郡', 0);
    const roleName = comp('roleName', '刺史', 2);
    const persName = comp('persName', '範', 4);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([placeName, roleName, persName]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.map((s) => s.tag)).toEqual(['roleName', 'persName']);
    expect(ungrouped).toEqual([placeName]);
  });

  it('allows a same-slot component to repeat within a run (e.g. two offices)', () => {
    const roleName1 = comp('roleName', '尚書', 0);
    const roleName2 = comp('roleName', '刺史', 2);
    const persName = comp('persName', '範', 4);
    const { groups } = groupWrapperCandidateSuggestions([roleName1, roleName2, persName]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.map((s) => s.tag)).toEqual(['roleName', 'roleName', 'persName']);
    expect(groups[0]!.suggestion.anchor.surface).toBe('尚書刺史範');
  });

  it('never extends a run past a persName — a second persName starts its own run', () => {
    // Two distinct names touching with zero gap: 王安石 then 司馬光. These
    // must not merge into one wrapper candidate.
    const first = comp('persName', '王安石', 0);
    const second = comp('roleName', '刺史', 3);
    const third = comp('persName', '司馬光', 5);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([first, second, third]);

    // `first` (王安石) is a lone persName with nothing valid preceding it —
    // ungrouped. `second`+`third` (刺史 + 司馬光) form a valid run.
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toEqual([second, third]);
    expect(ungrouped).toEqual([first]);
  });

  it('ignores non-pending and non-add suggestions', () => {
    const roleName = comp('roleName', '刺史', 0, { status: 'accepted' });
    const persName = comp('persName', '範', 2);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([roleName, persName]);

    expect(groups).toHaveLength(0);
    expect(ungrouped).toEqual([roleName, persName]);
  });

  it('leaves suggestions for tags outside the wrapper vocabulary untouched', () => {
    const title = comp('title', '南齊書', 0);
    const roleName = comp('roleName', '刺史', 3);
    const persName = comp('persName', '範', 5);
    const { groups, ungrouped } = groupWrapperCandidateSuggestions([title, roleName, persName]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toEqual([roleName, persName]);
    expect(ungrouped).toEqual([title]);
  });
});
