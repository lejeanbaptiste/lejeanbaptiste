/**
 * Decompose a user-selected span into noble-title components, so manual
 * tagging becomes "select the title, confirm the parse" instead of tagging
 * each component by hand.
 *
 * Detection is the human's job here — they selected the span — so this only
 * has to decompose. That removes the false-positive exposure a document-wide
 * detector would carry, and lets the vocabularies stay permissive.
 *
 * The span may already contain tagged elements (typically a `<placeName>` on
 * the fief, possibly carrying `@ref`). Those are preserved, never rewritten,
 * and they *constrain* the parse: a slot must either sit entirely inside one
 * untagged text run, or coincide exactly with one existing element. So a
 * pre-tagged fief pins its own boundary and makes the parse strictly more
 * accurate — while a tag that straddles two components is reported as a
 * conflict rather than silently destroyed.
 */

import type { AuthorityCandidate } from './authority';
import { DYNASTY_CROSSWALK } from './dynastyCrosswalkData';

/**
 * Well-attested ranks, used as a floor so parsing still works if the Norbert
 * pack is missing or stale. Merged with whatever the pack supplies.
 * `nt` is a genuinely closed set in Norbert (44 distinct values).
 */
const SEED_RANKS = [
  '皇帝', '天皇', '皇后', '太后', '太妃', '太子', '世子', '公主', '皇女', '夫人',
  '婕妤', '倢伃', '貴妃', '賢妃', '淑妃', '昭儀', '昭容', '昭華', '脩容', '貴嬪',
  '貴人', '淑媛', '美人', '後主', '幼主', '天王',
  '帝', '王', '公', '侯', '伯', '子', '男', '后', '妃', '君', '主', '姬', '嬪', '妾',
] as const;

export interface NobleTitleVocabulary {
  ranks: Set<string>;
  posthumousNames: Set<string>;
  fiefs: Set<string>;
  dynasties: Set<string>;
}

/**
 * Derive parsing vocabularies from the compiled Norbert noble-title pack.
 * No new asset is needed: `wiki-nt-links.ndjson` already carries fief, rank,
 * posthumous name and dynasty on every record, so the vocabulary stays in
 * sync with the pack automatically. Dynasty labels are additionally seeded
 * from the curated crosswalk.
 */
export function buildNobleTitleVocabulary(
  candidates: Iterable<AuthorityCandidate> = [],
): NobleTitleVocabulary {
  const vocabulary: NobleTitleVocabulary = {
    ranks: new Set<string>(SEED_RANKS),
    posthumousNames: new Set<string>(),
    fiefs: new Set<string>(),
    dynasties: new Set<string>(),
  };
  for (const entry of DYNASTY_CROSSWALK) {
    const label = entry.label?.trim();
    if (label) vocabulary.dynasties.add(label);
  }
  for (const candidate of candidates) {
    const title = candidate.metadata?.nobleTitle;
    if (!title) continue;
    const add = (set: Set<string>, value?: string | null) => {
      const trimmed = value?.trim();
      if (trimmed) set.add(trimmed);
    };
    add(vocabulary.fiefs, title.fief);
    add(vocabulary.ranks, title.roleName);
    add(vocabulary.posthumousNames, title.posthumousName);
    add(vocabulary.dynasties, candidate.metadata?.dynasty);
  }
  return vocabulary;
}

/** One piece of the selected span: either untagged text, or an existing element. */
export type SpanSegment =
  | { kind: 'text'; text: string }
  | { kind: 'element'; text: string; localName: string };

export type SlotRole = 'dynasty' | 'fief' | 'posthumousName' | 'rank' | 'personName';

/** TEI element each slot maps to inside `<nobleTitle>`; dynasty maps to `@dynasty`. */
export const SLOT_TAG: Record<Exclude<SlotRole, 'dynasty'>, string> = {
  fief: 'placeName',
  posthumousName: 'persName',
  rank: 'roleName',
  personName: 'persName',
};

export interface ParsedSlot {
  role: SlotRole;
  text: string;
  /** Index of the segment this slot came from. */
  segmentIndex: number;
  /** Set when the slot coincides exactly with a pre-existing element. */
  existingTag?: string;
  /**
   * True when the existing element's tag differs from the one this slot
   * needs, so applying the parse would have to retag (or refuse to).
   */
  retagRequired?: boolean;
  /** True when the slot's text was not found in its vocabulary. */
  unverified?: boolean;
}

export interface ParsedNobleTitleSpan {
  slots: ParsedSlot[];
  /** Reasons the span could not be parsed, or could only be parsed loosely. */
  conflicts: string[];
  /**
   * `exact` — every slot verified against a vocabulary.
   * `partial` — parsed, but at least one slot is unverified.
   * `none` — no valid decomposition; `slots` is empty.
   */
  confidence: 'exact' | 'partial' | 'none';
}

interface FlatSpan {
  text: string;
  /** segmentIndex per character. */
  owner: number[];
  /** Character offset each segment starts at. */
  starts: number[];
}

function flatten(segments: readonly SpanSegment[]): FlatSpan {
  let text = '';
  const owner: number[] = [];
  const starts: number[] = [];
  segments.forEach((segment, index) => {
    starts.push(text.length);
    const value = segment.text.normalize('NFC');
    text += value;
    for (let i = 0; i < value.length; i++) owner.push(index);
  });
  return { text, owner, starts };
}

/**
 * A candidate slot range is placeable when it lies inside a single text
 * segment, or covers exactly one whole element segment. Anything else would
 * mean splitting or absorbing existing markup.
 */
function placement(
  flat: FlatSpan,
  segments: readonly SpanSegment[],
  start: number,
  end: number,
): { segmentIndex: number; existingTag?: string } | null {
  if (start >= end) return null;
  const first = flat.owner[start]!;
  for (let i = start + 1; i < end; i++) if (flat.owner[i] !== first) return null;
  const segment = segments[first]!;
  if (segment.kind === 'text') return { segmentIndex: first };
  const segStart = flat.starts[first]!;
  if (start !== segStart || end !== segStart + segment.text.normalize('NFC').length) return null;
  return { segmentIndex: first, existingTag: segment.localName };
}

interface Candidate {
  slots: ParsedSlot[];
  score: number;
  unverified: number;
}

/**
 * Parse a selected span into noble-title components.
 *
 * Anchors on the rank — the only genuinely closed slot — then works leftward
 * over the prefix, enumerating [dynasty?][fief?][posthumousName?] splits.
 * A single leading component is read as a fief when the vocabulary knows it
 * as one, since Norbert records a dynastic house's fief as its own name
 * (Cao Cao's fief is 魏), and only as a dynasty otherwise.
 */
export function parseNobleTitleSpan(
  segments: readonly SpanSegment[],
  vocabulary: NobleTitleVocabulary,
): ParsedNobleTitleSpan {
  const flat = flatten(segments);
  const text = flat.text;
  const conflicts: string[] = [];
  if (!text.trim()) return { slots: [], conflicts: ['empty span'], confidence: 'none' };

  const candidates: Candidate[] = [];

  // Anchor: every recognised rank occurrence, longest first.
  const rankValues = [...vocabulary.ranks].sort((a, b) => b.length - a.length);
  for (const rank of rankValues) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(rank, from);
      if (at < 0) break;
      from = at + 1;
      const rankEnd = at + rank.length;
      const rankPlacement = placement(flat, segments, at, rankEnd);
      if (!rankPlacement) continue;

      // Trailing remainder after the rank is a personal name (封爵名 family).
      const tail = text.slice(rankEnd);
      let tailSlot: ParsedSlot | null = null;
      if (tail) {
        const tailPlacement = placement(flat, segments, rankEnd, text.length);
        if (!tailPlacement) continue;
        tailSlot = { role: 'personName', text: tail, ...tailPlacement, unverified: true };
      }

      const prefix = text.slice(0, at);
      for (const split of enumeratePrefixSplits(prefix, vocabulary)) {
        const slots: ParsedSlot[] = [];
        let ok = true;
        let unverified = 0;
        let score = 0;

        for (const part of split) {
          const partPlacement = placement(flat, segments, part.start, part.end);
          if (!partPlacement) {
            ok = false;
            break;
          }
          const slot: ParsedSlot = { role: part.role, text: part.text, ...partPlacement };
          if (part.unverified) {
            slot.unverified = true;
            unverified++;
          } else {
            score += 3;
            // Norbert records a dynastic house's fief as its own name (Cao
            // Cao's fief is 魏), so a lone leading component that both
            // vocabularies know is more usefully read as the fief.
            if (part.role === 'fief') score += 1;
          }
          if (slot.existingTag) {
            const wanted = part.role === 'dynasty' ? null : SLOT_TAG[part.role];
            if (wanted && slot.existingTag !== wanted) slot.retagRequired = true;
            // A pre-existing tag that agrees with the parse is strong evidence.
            score += slot.existingTag === wanted ? 5 : 1;
          }
          slots.push(slot);
        }
        if (!ok) continue;

        const rankSlot: ParsedSlot = { role: 'rank', text: rank, ...rankPlacement };
        if (rankSlot.existingTag) {
          if (rankSlot.existingTag !== SLOT_TAG.rank) rankSlot.retagRequired = true;
          score += rankSlot.existingTag === SLOT_TAG.rank ? 5 : 1;
        }
        slots.push(rankSlot);
        score += 3;
        if (tailSlot) {
          slots.push(tailSlot);
          unverified++;
        }
        // Prefer longer ranks and richer decompositions.
        score += rank.length + slots.length;
        candidates.push({ slots, score, unverified });
      }
    }
  }

  if (candidates.length === 0) {
    const hasRank = rankValues.some((rank) => text.includes(rank));
    conflicts.push(
      hasRank
        ? 'a recognised rank is present, but existing markup in the span does not align with any component boundary'
        : 'no recognised noble-title rank in the span',
    );
    return { slots: [], conflicts, confidence: 'none' };
  }

  candidates.sort((a, b) => a.unverified - b.unverified || b.score - a.score);
  const best = candidates[0]!;

  for (const slot of best.slots) {
    if (slot.retagRequired) {
      conflicts.push(
        `existing <${slot.existingTag}> on "${slot.text}" does not match the ${slot.role} component (expected <${
          slot.role === 'dynasty' ? 'none' : SLOT_TAG[slot.role]
        }>)`,
      );
    }
    // An existing tag fixes its own boundary, so a tag that swallows more
    // than one component can never surface as a placement failure. Detect it
    // instead by asking whether the tagged text decomposes cleanly on its
    // own — if it does, the tag probably spans too much.
    if (slot.unverified && slot.existingTag && slot.role !== 'rank') {
      const inner = enumeratePrefixSplits(slot.text, vocabulary)
        .filter((parts) => parts.length > 1 && parts.every((part) => !part.unverified))
        .sort((a, b) => Number(b.some((p) => p.role === 'fief')) - Number(a.some((p) => p.role === 'fief')))[0];
      if (inner) {
        conflicts.push(
          `existing <${slot.existingTag}> covers "${slot.text}", but that decomposes into ${inner
            .map((part) => `${part.role} "${part.text}"`)
            .join(' + ')} — the tag may span more than the ${slot.role}`,
        );
      }
    }
  }

  return {
    slots: best.slots,
    conflicts,
    confidence: best.unverified === 0 ? 'exact' : 'partial',
  };
}

interface PrefixPart {
  role: Exclude<SlotRole, 'rank' | 'personName'>;
  text: string;
  start: number;
  end: number;
  unverified?: boolean;
}

/** Enumerate [dynasty?][fief?][posthumousName?] splits of the pre-rank prefix. */
function enumeratePrefixSplits(
  prefix: string,
  vocabulary: NobleTitleVocabulary,
): PrefixPart[][] {
  if (!prefix) return [[]];
  const splits: PrefixPart[][] = [];
  const n = prefix.length;

  for (let i = 0; i <= n; i++) {
    for (let j = i; j <= n; j++) {
      const dynasty = prefix.slice(0, i);
      const fief = prefix.slice(i, j);
      const posthumous = prefix.slice(j);

      // Dynasty is a well-closed set, so require membership there — it keeps
      // junk out of the leading slot. Fief is open (a title may name a place
      // Norbert has never recorded), so an unknown fief is allowed but scored
      // down; when the span already tags it as <placeName>, the tag-agreement
      // bonus is what promotes this reading over reading it as a 謚號.
      if (dynasty && !vocabulary.dynasties.has(dynasty)) continue;

      const parts: PrefixPart[] = [];
      if (dynasty) parts.push({ role: 'dynasty', text: dynasty, start: 0, end: i });
      if (fief) {
        parts.push({
          role: 'fief',
          text: fief,
          start: i,
          end: j,
          unverified: !vocabulary.fiefs.has(fief),
        });
      }
      if (posthumous) {
        parts.push({
          role: 'posthumousName',
          text: posthumous,
          start: j,
          end: n,
          // Posthumous names are the open slot — new ones exist — so an
          // unrecognised one is allowed, just scored lower.
          unverified: !vocabulary.posthumousNames.has(posthumous),
        });
      }
      splits.push(parts);
    }
  }
  return splits;
}
