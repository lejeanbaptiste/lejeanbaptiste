/**
 * Faithful port of Norbert's `nt_combos()` (taggingFunctions.py) — the noble
 * title half of the `nttg3()` / `persName_expansion` pass.
 *
 * Each rule below keeps its original Chinese column name (朝封謚爵, 本朝廟號,
 * …) so generated strings stay traceable back to the Python source. The
 * original expresses each rule as a pandas assignment over a filtered frame;
 * because string concatenation with NaN yields NaN and the collector drops
 * nulls, **a rule only fires when every component it references is present**.
 * `joinAll()` reproduces that semantics exactly.
 *
 * Two families of output, matching the original's `unambig` / `abr` split:
 *
 * - **Unambiguous** (`dynastyScoped: false`): dynasty-qualified, so safe to
 *   match anywhere, e.g. 漢孝武帝.
 * - **Dynasty-scoped** (`dynastyScoped: true`): the original's `abr` block —
 *   abbreviated forms that are only unambiguous *within* their own dynasty,
 *   e.g. 煬帝, 高祖. Callers matching a document already known to be set in
 *   that dynasty may use them; general matching should not.
 */

/**
 * `main_dynasties` (taggingFunctions.py:9669) — dynasties where a 謚號 can be
 * abbreviated, or take the 皇 infix, without ambiguity. Deliberately a curated
 * subset: applying these forms to every short-lived regime was too noisy.
 */
const MAIN_DYNASTY_IDS = new Set([
  41, 42, 43, 46, 48, 49, 50, 51, 52, 53, 81, 82, 83, 84, 85, 86, 87, 88, 89, 92, 93, 95, 96, 97,
  119, 121, 123, 124, 125, 127,
]);

/** 先秦 / 三皇五帝 — not real dynasties; excluded wholesale (taggingFunctions.py:9666). */
const NON_DYNASTY_IDS = new Set([1, 2]);

/**
 * Ranks for which the 皇 honorific infix produces a real form — 皇帝, 皇后,
 * 皇太后, 皇太妃, 皇太子. Used only when `corrections` is on: the original
 * applies the infix with either no rank filter (本朝謚皇后, 本朝廟) or one
 * that includes 王 (朝封謚-皇帝), yielding non-words like 武皇王 and 文皇公.
 */
const HONORIFIC_INFIX_RANKS = new Set(['帝', '后', '太后', '太妃', '太子']);

export interface NobleTitleComponents {
  /** `dyn` — dynasty label. May differ from the canonical name (alternate spellings). */
  dynasty?: string | null;
  /** `dyn_id` — gates the `main_dynasties` rules. */
  dynastyId?: number | null;
  /** `fief` — territorial component. */
  fief?: string | null;
  /** `pn` — posthumous name (謚號). */
  posthumousName?: string | null;
  /** `pn_abr` — abbreviated posthumous name, e.g. 孝武 → 武. */
  posthumousNameAbbr?: string | null;
  /** `nt` — rank/title (帝, 王, 公, 太子, 后, …). */
  rank?: string | null;
  /** `tn` — temple name (廟號), e.g. 太祖. */
  templeName?: string | null;
  /** `姓` — family name. */
  familyName?: string | null;
  /** `名` — given name. */
  givenName?: string | null;
}

export interface ExpandedTitleString {
  text: string;
  /** Original Python column name for the rule that produced this string. */
  rule: string;
  /** True for the `abr` block: only unambiguous inside the title's own dynasty. */
  dynastyScoped: boolean;
  /** True when the string embeds a personal name (姓 and/or 名). */
  includesPersonName: boolean;
}

/** Concatenate, yielding null if ANY part is missing — mirrors pandas NaN propagation. */
function joinAll(...parts: (string | null | undefined)[]): string | null {
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) return null;
    out.push(trimmed);
  }
  return out.join('');
}

export interface ExpandNobleTitleOptions {
  /** Emit the dynasty-qualified block (original `unambig`). Default true. */
  unambiguous?: boolean;
  /** Emit the dynasty-scoped abbreviation block (original `abr`). Default true. */
  abbreviated?: boolean;
  /**
   * Correct two defects in the original Python. Default true; set false to
   * reproduce `nt_combos()` byte-for-byte when diffing against the source.
   *
   * 1. Gate the 皇 honorific infix to {@link HONORIFIC_INFIX_RANKS}. The
   *    original emits it for any rank, producing 武皇王 / 文皇公 / 孝徳皇天皇.
   *    Purely subtractive: no new strings, only malformed ones removed.
   * 2. Treat the fief as dynastic when the dynasty label *ends with* it,
   *    rather than when its last character equals it. The original's
   *    `dyn.str[-1] == fief` assumes a single-character fief, so a
   *    multi-character house whose fief is its own name (吳越, 仇池, 武周,
   *    and every Japanese/Korean dynasty) is misrouted to the territorial
   *    branch and emits doubled strings like 日本日本孝徳天皇.
   */
  corrections?: boolean;
}

/**
 * Expand one `person_nt` row into every search string Norbert's `nt_combos`
 * would generate for it.
 */
export function expandNobleTitle(
  components: NobleTitleComponents,
  options: ExpandNobleTitleOptions = {},
): ExpandedTitleString[] {
  const { unambiguous = true, abbreviated = true, corrections = true } = options;
  const {
    dynasty: dyn,
    dynastyId,
    fief,
    posthumousName: pn,
    posthumousNameAbbr: pnAbr,
    rank: nt,
    templeName: tn,
    familyName: xing,
    givenName: ming,
  } = components;

  if (dynastyId != null && NON_DYNASTY_IDS.has(dynastyId)) return [];

  const results: ExpandedTitleString[] = [];
  const seen = new Set<string>();
  const push = (
    rule: string,
    text: string | null,
    dynastyScoped: boolean,
    includesPersonName = false,
  ) => {
    if (!text) return;
    const key = `${text}${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ text, rule, dynastyScoped, includesPersonName });
  };

  const isMainDynasty = dynastyId != null && MAIN_DYNASTY_IDS.has(dynastyId);
  const rank = nt?.trim();
  /** Correction 1: is the 皇 infix a real form for this rank? */
  const allowsHonorificInfix = !corrections || (!!rank && HONORIFIC_INFIX_RANKS.has(rank));

  // ── Unambiguous: dynasty-qualified, applicable everywhere ──────────────
  if (unambiguous) {
    // 朝廟 — assigned before the dyn+fief filter, so it needs no fief.
    push('朝廟', joinAll(dyn, tn), false);

    // The remaining rules run on `b`, which drops rows missing dyn OR fief —
    // so fief must be present even for rules whose formula omits it.
    if (dyn?.trim() && fief?.trim()) {
      // The original discriminates "emperor-like" from territorial nobility by
      // comparing the LAST character of the dynasty label to the fief
      // (dyn.str[-1] == fief), so 三國魏 + 魏 counts as dynastic. Correction 2
      // generalizes this to endsWith, which is identical for single-character
      // fiefs but also catches multi-character houses (吳越, 日本).
      const dynastic = corrections
        ? dyn.trim().endsWith(fief.trim())
        : dyn.trim().slice(-1) === fief.trim();
      const noble = !dynastic;

      if (noble) push('朝封謚爵', joinAll(dyn, fief, pn, nt), false); // 魏博陵文簡王
      if (dynastic && rank && !['后', '妃'].includes(rank)) {
        push('朝封謚爵', joinAll(dyn, pn, nt), false); // 漢孝武帝
      }
      // Original gate is ['帝','王']; the 王 half yields 皇王, so corrections
      // narrow it to 帝 (intersecting the original set with the valid one).
      const honorificEmperorGate = corrections
        ? rank === '帝'
        : !!rank && ['帝', '王'].includes(rank);
      if (honorificEmperorGate && isMainDynasty) {
        push('朝封謚-皇帝', joinAll(dyn, pn, '皇', nt), false); // 漢孝武皇帝
      }
      if (noble) {
        push('朝封爵', joinAll(dyn, fief, nt), false); // 魏博陵王
        push('朝封謚爵姓名', joinAll(dyn, fief, pn, nt, xing, ming), false, true);
        push('朝封謚爵名', joinAll(dyn, fief, pn, nt, ming), false, true);
        push('封爵姓名', joinAll(fief, nt, xing, ming), false, true);
        push('封爵名', joinAll(fief, nt, ming), false, true);
        push('封謚爵名', joinAll(fief, pn, nt, ming), false, true);
      }
      if (dynastic) push('朝謚爵', joinAll(dyn, pn, nt), false); // 梁安固公主

      // `c` additionally drops rows missing pn_abr.
      if (pnAbr?.trim() && dynastic && isMainDynasty && nt?.trim() === '帝') {
        push('朝封謚-爵', joinAll(dyn, pnAbr, nt), false); // 漢孝武帝 → 漢武帝
      }
    }
  }

  // ── Dynasty-scoped abbreviations (original `abr` block) ────────────────
  if (abbreviated) {
    push('本朝封謚爵', joinAll(fief, pn, nt), true); // 博陵文簡王

    if (nt?.trim() === '太子') {
      push('太子名', joinAll(nt, ming), true, true); // 太子勇
      push('皇太子名', joinAll('皇', nt, ming), true, true); // 皇太子勇
    }

    push('本朝廟號', tn?.trim() || null, true); // 高祖
    if (allowsHonorificInfix) push('本朝廟', joinAll(tn, pn, '皇', nt), true); // 太祖文皇帝

    if (rank && ['帝', '太子'].includes(rank)) {
      push('本朝謚爵', joinAll(pn, nt), true); // 煬帝
      push('本朝爵', joinAll(pnAbr, nt), true);
    }

    if (nt && ['太后', '太妃'].includes(nt.trim())) {
      push('皇太后', joinAll('皇', nt, xing, '氏'), true, true); // 皇太后常氏
    }

    // Note: this block compares dyn to fief by FULL equality, unlike the
    // unambiguous block's last-character comparison. Reproduced as-is.
    if (dyn?.trim() && fief?.trim() && dyn.trim() === fief.trim()) {
      // Commented "For empresses (?)" in the original, but it carries no rank
      // filter, so it also fires for emperors — which is what produces the
      // bare 武皇帝 that CBDB stores as Cao Cao's posthumous name. That much is
      // wanted; the unfiltered 王/公/天皇 output is not (see correction 1).
      if (allowsHonorificInfix) push('本朝謚皇后', joinAll(pn, '皇', nt), true);
      if (pnAbr?.trim() && rank === '后') {
        push('本朝謚-皇后', joinAll(pnAbr, '皇', nt), true);
      }
    }
  }

  return results;
}

/** Convenience: just the distinct strings, dropping rule/provenance detail. */
export function expandNobleTitleStrings(
  components: NobleTitleComponents,
  options?: ExpandNobleTitleOptions,
): string[] {
  return [...new Set(expandNobleTitle(components, options).map((entry) => entry.text))];
}
