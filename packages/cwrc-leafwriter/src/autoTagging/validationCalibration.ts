import type { ChunkOptions } from './chunk';
import { llmSuggest } from './llmSuggest';
import type { LlmCache } from './llmCache';
import type { LlmClient } from './llmClient';
import { validateSuggestions } from './llmValidationRank';
import { DEFAULT_AUTO_ACCEPT_THRESHOLD } from './validationSettings';
import { goldMentions, stripTags, type GoldMention } from './validationHarness';
import type { AiValidationResult, Suggestion } from './types';
import { runAuthorityTagBombOnDocument, type AuthorityTagBombOptions } from './authorityTagBomb';
import type { AuthorityPackContent, DateRangeFilter } from './packLoader';
import type { AuthorityPackId } from './packPaths';

const mentionKey = (surface: string, occurrence: number) => `${surface} ${occurrence}`;

/**
 * Drops `<note type="editor">` subtrees entirely (not just unwrapped, like
 * stripTags — removed) before scoring. Editorial notes quote source text
 * (e.g. a stele inscription cited to argue a character variant) that isn't
 * part of the document's own narrative; annotators commonly don't tag
 * entities inside them, so a tag-bomb/suggest hit there scores as a false
 * positive purely from being out of the gold annotator's scope, not because
 * the tag is wrong. Operates on a clone; the input document is untouched.
 */
export function removeEditorialNotes(doc: Document): Document {
  const clone = doc.cloneNode(true) as Document;
  const notes = clone.querySelectorAll('note[type="editor"]');
  for (const note of notes) note.parentNode?.removeChild(note);
  return clone;
}

/**
 * Whether each suggestion's (surface, occurrence, tag) matches a gold
 * mention — the ground truth "was this suggestion actually correct?" that
 * a validation confidence score is supposed to predict.
 */
export function labelSuggestionsAgainstGold(
  gold: GoldMention[],
  suggestions: Suggestion[],
): Map<string, boolean> {
  const goldMap = new Map<string, string>();
  for (const g of gold) goldMap.set(mentionKey(g.surface, g.occurrence), g.tag);

  const labels = new Map<string, boolean>();
  for (const s of suggestions) {
    const goldTag = goldMap.get(mentionKey(s.anchor.surface, s.anchor.occurrence));
    labels.set(s.id, goldTag !== undefined && goldTag === s.tag);
  }
  return labels;
}

export interface LabeledValidation {
  suggestionId: string;
  tag: string;
  surface: string;
  occurrence: number;
  /** Ground truth: does this suggestion match a gold mention of the same tag? */
  correct: boolean;
  validation: AiValidationResult;
}

function labelValidatedSuggestions(
  gold: GoldMention[],
  suggestions: Suggestion[],
  validations: Map<string, AiValidationResult>,
): LabeledValidation[] {
  const labels = labelSuggestionsAgainstGold(gold, suggestions);
  return suggestions
    .filter((s) => validations.has(s.id))
    .map((s) => ({
      suggestionId: s.id,
      tag: s.tag,
      surface: s.anchor.surface,
      occurrence: s.anchor.occurrence,
      correct: labels.get(s.id) ?? false,
      validation: validations.get(s.id)!,
    }));
}

export interface ThresholdConfusion {
  /** Suggestions with confidence >= threshold are treated as "kept". */
  threshold: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  accuracy: number;
}

/**
 * Confusion matrix for treating `confidence >= threshold` as the accept
 * decision, scored against ground truth correctness — answers "if we used
 * this number as the auto-accept/reject cutoff, how often would that be
 * the right call?"
 */
export function confusionAtThreshold(
  labeled: LabeledValidation[],
  threshold: number,
): ThresholdConfusion {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const l of labeled) {
    const kept = l.validation.confidence >= threshold;
    if (kept && l.correct) tp++;
    else if (kept && !l.correct) fp++;
    else if (!kept && l.correct) fn++;
    else tn++;
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const accuracy = labeled.length === 0 ? 1 : (tp + tn) / labeled.length;
  return { threshold, tp, fp, tn, fn, precision, recall, accuracy };
}

const DEFAULT_SWEEP = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** Confusion matrix at each candidate threshold, for picking a cutoff. */
export function sweepThresholds(
  labeled: LabeledValidation[],
  thresholds: number[] = DEFAULT_SWEEP,
): ThresholdConfusion[] {
  return thresholds.map((t) => confusionAtThreshold(labeled, t));
}

export interface CalibrationBucket {
  rangeLabel: string;
  low: number;
  high: number;
  count: number;
  correctCount: number;
  /** Empirical fraction correct within this confidence bucket — compare to the bucket's own range for calibration. */
  accuracy: number;
  avgConfidence: number;
}

/**
 * Buckets suggestions by reported confidence and reports the empirical
 * accuracy in each bucket. A well-calibrated model's 0.7–0.8 bucket should
 * be right about 70-80% of the time; systematic over/under-confidence
 * shows up as buckets whose accuracy doesn't match their range.
 */
export function calibrationBuckets(
  labeled: LabeledValidation[],
  bucketSize = 0.1,
): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];
  const steps = Math.round(1 / bucketSize);
  for (let i = 0; i < steps; i++) {
    const low = Math.round(i * bucketSize * 100) / 100;
    const high = Math.min(1, Math.round((low + bucketSize) * 100) / 100);
    const inBucket = labeled.filter((l) => {
      const c = l.validation.confidence;
      return high === 1 ? c >= low && c <= high : c >= low && c < high;
    });
    const correctCount = inBucket.filter((l) => l.correct).length;
    buckets.push({
      rangeLabel: `${low.toFixed(1)}–${high.toFixed(1)}`,
      low,
      high,
      count: inBucket.length,
      correctCount,
      accuracy: inBucket.length === 0 ? NaN : correctCount / inBucket.length,
      avgConfidence:
        inBucket.length === 0
          ? NaN
          : inBucket.reduce((sum, l) => sum + l.validation.confidence, 0) / inBucket.length,
    });
  }
  return buckets;
}

export interface SameSpanAlternativeGroup {
  surface: string;
  occurrence: number;
  options: { tag: string; correct: boolean; confidence: number; recommended: boolean }[];
  /**
   * True when a correct option's confidence strictly beats every incorrect
   * option's confidence at this span — the thing that matters for review UX,
   * since "recommended" defaults to the highest-scored alternative. Null
   * when no option in the group is actually correct (can't rank correctly
   * against nothing) or confidences tie.
   */
  rankedCorrectHighest: boolean | null;
}

/**
 * Groups suggestions that share a span (same surface, same document
 * occurrence) but disagree on tag — e.g. 將軍 offered as both roleName and
 * placeName — and checks whether validation confidence puts the correct
 * tag ahead of the wrong one. This is the case scoreSuggestions/calibration
 * buckets don't isolate: a model can be "accurate on average" while still
 * failing every time it has to pick between two live alternatives.
 */
export function sameSpanAlternativeGroups(
  labeled: LabeledValidation[],
): SameSpanAlternativeGroup[] {
  const groups = new Map<string, LabeledValidation[]>();
  for (const l of labeled) {
    const key = mentionKey(l.surface, l.occurrence);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  const results: SameSpanAlternativeGroup[] = [];
  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const options = items.map((i) => ({
      tag: i.tag,
      correct: i.correct,
      confidence: i.validation.confidence,
      recommended: i.validation.recommended,
    }));
    const correctOptions = options.filter((o) => o.correct);
    const incorrectMax = options
      .filter((o) => !o.correct)
      .reduce((max, o) => Math.max(max, o.confidence), -Infinity);
    const rankedCorrectHighest =
      correctOptions.length === 0 ? null : correctOptions.some((o) => o.confidence > incorrectMax);
    results.push({
      surface: items[0]!.surface,
      occurrence: items[0]!.occurrence,
      options,
      rankedCorrectHighest,
    });
  }
  return results;
}

export interface SameSpanSummary {
  groupCount: number;
  /** Groups with a correct option present, i.e. ones where ranking is actually decidable. */
  decidableCount: number;
  rankedCorrectCount: number;
  /** Fraction of decidable groups where validate ranked the correct tag above the wrong one(s). */
  accuracy: number;
}

export function summarizeSameSpanGroups(groups: SameSpanAlternativeGroup[]): SameSpanSummary {
  const decidable = groups.filter((g) => g.rankedCorrectHighest !== null);
  const rankedCorrectCount = decidable.filter((g) => g.rankedCorrectHighest === true).length;
  return {
    groupCount: groups.length,
    decidableCount: decidable.length,
    rankedCorrectCount,
    accuracy: decidable.length === 0 ? NaN : rankedCorrectCount / decidable.length,
  };
}

export interface ValidationCalibrationReport {
  labeled: LabeledValidation[];
  suggestCount: number;
  /** Candidates the model never returned a validation for (dropped batch entries) — not counted as correct or incorrect. */
  unvalidatedCount: number;
  goldCount: number;
  correctCount: number;
  incorrectCount: number;
  buckets: CalibrationBucket[];
  /** Confusion at the project's configured (or supplied) auto-accept threshold. */
  atConfiguredThreshold: ThresholdConfusion;
  sweep: ThresholdConfusion[];
  sameSpanGroups: SameSpanAlternativeGroup[];
  sameSpanSummary: SameSpanSummary;
}

function buildReport(
  labeled: LabeledValidation[],
  suggestCount: number,
  goldCount: number,
  threshold: number,
): ValidationCalibrationReport {
  const sameSpanGroups = sameSpanAlternativeGroups(labeled);
  return {
    labeled,
    suggestCount,
    unvalidatedCount: suggestCount - labeled.length,
    goldCount,
    correctCount: labeled.filter((l) => l.correct).length,
    incorrectCount: labeled.filter((l) => !l.correct).length,
    buckets: calibrationBuckets(labeled),
    atConfiguredThreshold: confusionAtThreshold(labeled, threshold),
    sweep: sweepThresholds(labeled),
    sameSpanGroups,
    sameSpanSummary: summarizeSameSpanGroups(sameSpanGroups),
  };
}

export interface RunValidationCalibrationOptions extends ChunkOptions {
  tags: string[];
  /** Client used to generate the candidate suggestions (mix of right and wrong against gold). */
  suggestClient: LlmClient;
  /** Client used to score those suggestions — defaults to suggestClient. */
  validateClient?: LlmClient;
  cache?: LlmCache;
  schemaRules?: string[];
  language?: string;
  /** Threshold to report confusion for — defaults to the product default (0.8). */
  autoAcceptThreshold?: number;
  /** Suggestions per validate call — smaller batches reduce truncated/incomplete responses on small local models. */
  validateBatchSize?: number;
  /** Drop <note type="editor"> content before scoring — see removeEditorialNotes. */
  excludeEditorialNotes?: boolean;
}

/**
 * Runs suggest (producing a natural mix of true and false positives against
 * a hand-tagged gold document) then validate, and scores whether the
 * validation confidence actually separates the right suggestions from the
 * wrong ones — the question "is the certainty threshold accurate?" that
 * scoreSuggestions/runValidationHarness don't answer, since those measure
 * span-finding recall, not confidence calibration.
 */
export async function runValidationCalibrationHarness(
  doc: Document,
  options: RunValidationCalibrationOptions,
): Promise<ValidationCalibrationReport> {
  const scoped = options.excludeEditorialNotes ? removeEditorialNotes(doc) : doc;
  const gold = goldMentions(scoped, options.policy, options.tags);
  const stripped = stripTags(scoped, options.tags);

  const suggestResult = await llmSuggest(stripped, {
    ...options,
    client: options.suggestClient,
  });

  const validations = await validateSuggestions({
    suggestions: suggestResult.suggestions,
    client: options.validateClient ?? options.suggestClient,
    schemaRules: options.schemaRules,
    language: options.language,
    batchSize: options.validateBatchSize,
  });

  const labeled = labelValidatedSuggestions(gold, suggestResult.suggestions, validations);
  const threshold = options.autoAcceptThreshold ?? DEFAULT_AUTO_ACCEPT_THRESHOLD;

  return buildReport(labeled, suggestResult.suggestions.length, gold.length, threshold);
}

export interface RunAuthorityTagBombCalibrationOptions {
  policy: ChunkOptions['policy'];
  tags: string[];
  packIds: AuthorityPackId[];
  readPackFile: (
    packId: AuthorityPackId,
    dateFilter?: DateRangeFilter,
  ) => Promise<AuthorityPackContent>;
  dateFilter?: DateRangeFilter;
  yearRange?: { start: number; end: number };
  hideUndated?: boolean;
  nameTypePolicy?: AuthorityTagBombOptions['nameTypePolicy'];
  /** Client used to score the tag-bomb's candidates. */
  validateClient: LlmClient;
  schemaRules?: string[];
  language?: string;
  /** Threshold to report confusion for — defaults to the product default (0.8). */
  autoAcceptThreshold?: number;
  /** Suggestions per validate call — smaller batches reduce truncated/incomplete responses on small local models. */
  validateBatchSize?: number;
  /** Drop <note type="editor"> content before scoring — see removeEditorialNotes. */
  excludeEditorialNotes?: boolean;
}

export interface AuthorityTagBombCalibrationReport extends ValidationCalibrationReport {
  candidateCount: number;
  matchCount: number;
  truncated: boolean;
  loaded: Partial<Record<AuthorityPackId, number>>;
}

/**
 * Runs the real authority tag bomb (deterministic dictionary/authority-pack
 * matching — the actual production candidate source, not an LLM) against a
 * hand-tagged gold document, then scores AI validate's ability to clean up
 * its output: does confidence separate right matches from wrong ones, and —
 * the case that matters most for review UX — when the tag bomb offers two
 * competing tags for the same span (e.g. 將軍 as both roleName and
 * placeName), does validate confidently rank the correct one above the
 * wrong one?
 */
export async function runAuthorityTagBombCalibrationHarness(
  doc: Document,
  options: RunAuthorityTagBombCalibrationOptions,
): Promise<AuthorityTagBombCalibrationReport> {
  const scoped = options.excludeEditorialNotes ? removeEditorialNotes(doc) : doc;
  const gold = goldMentions(scoped, options.policy, options.tags);
  const stripped = stripTags(scoped, options.tags);

  const tagBombResult = await runAuthorityTagBombOnDocument(
    stripped,
    options.packIds,
    options.readPackFile,
    options.policy,
    {
      dateFilter: options.dateFilter,
      yearRange: options.yearRange,
      hideUndated: options.hideUndated,
      nameTypePolicy: options.nameTypePolicy,
    },
  );

  const validations = await validateSuggestions({
    suggestions: tagBombResult.suggestions,
    client: options.validateClient,
    schemaRules: options.schemaRules,
    language: options.language,
    batchSize: options.validateBatchSize,
  });

  const labeled = labelValidatedSuggestions(gold, tagBombResult.suggestions, validations);
  const threshold = options.autoAcceptThreshold ?? DEFAULT_AUTO_ACCEPT_THRESHOLD;

  return {
    ...buildReport(labeled, tagBombResult.suggestions.length, gold.length, threshold),
    candidateCount: tagBombResult.candidateCount,
    matchCount: tagBombResult.matchCount,
    truncated: tagBombResult.truncated,
    loaded: tagBombResult.loaded,
  };
}
