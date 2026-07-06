import { buildDocIndex, resolveAnchor, resolveXPath } from './anchor';
import type { ApplyOptions, ApplyResult, BatchResult } from './apply';
import { buildSearchText, hashText } from './normalize';
import type { Anchor, Suggestion, WhitespacePolicy } from './types';

export interface ApplyDiagnosticsLine {
  suggestionId: string;
  surface: string;
  action: string;
  tag: string;
  outcome: ApplyResult['outcome'];
  reason: string;
}

export interface ApplyDiagnosticsReport {
  applied: number;
  total: number;
  byOutcome: Partial<Record<ApplyResult['outcome'], number>>;
  lines: ApplyDiagnosticsLine[];
  summary: string;
}

const APPLY_DEBUG_KEY = 'ljb.autoTaggingApplyDebug';

/** Turn on verbose apply logging: localStorage.setItem('ljb.autoTaggingApplyDebug', '1') */
export function isApplyDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(APPLY_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

function countSurfaceInDocument(doc: Document, surface: string, policy: WhitespacePolicy): number {
  const index = buildDocIndex(doc, policy);
  let count = 0;
  for (const { search } of index.nodes) {
    let from = 0;
    while (true) {
      const idx = search.text.indexOf(surface, from);
      if (idx === -1) break;
      count++;
      from = idx + 1;
    }
  }
  return count;
}

/** Human-readable explanation when resolveAnchor returns null. */
export function explainAnchorFailure(
  doc: Document,
  anchor: Anchor,
  policy: WhitespacePolicy,
): string {
  const target = resolveXPath(doc, anchor.xpath);
  if (!target) {
    return `XPath not found in the current document: ${anchor.xpath}`;
  }

  const search = buildSearchText(target.data, policy);
  const currentHash = hashText(search.text);
  if (currentHash !== anchor.nodeHash) {
    const count = countSurfaceInDocument(doc, anchor.surface, policy);
    return (
      `Text at the anchor path was edited since tagging (content hash changed). ` +
      `Looking for "${anchor.surface}" (occurrence #${anchor.occurrence}); ` +
      `found ${count} match(es) in the document now.`
    );
  }

  const searchIndex = search.map.indexOf(anchor.offset);
  if (searchIndex === -1) {
    return `Character offset ${anchor.offset} is no longer valid in the anchored text node.`;
  }

  const atOffset = search.text.slice(searchIndex);
  if (!atOffset.startsWith(anchor.surface)) {
    const preview = atOffset.slice(0, Math.min(12, atOffset.length));
    return (
      `Surface "${anchor.surface}" is not at the stored offset; ` +
      `the node now has "${preview}${atOffset.length > preview.length ? '…' : ''}" there.`
    );
  }

  const count = countSurfaceInDocument(doc, anchor.surface, policy);
  return (
    `Anchor could not be verified (context tiebreaker failed). ` +
    `"${anchor.surface}" occurs ${count} time(s); expected occurrence #${anchor.occurrence}.`
  );
}

function explainResolveDateFailure(
  doc: Document,
  suggestion: Suggestion,
  policy: WhitespacePolicy,
): string {
  const resolved = resolveAnchor(doc, suggestion.anchor, policy);
  if (!resolved) {
    return explainAnchorFailure(doc, suggestion.anchor, policy);
  }

  let dateEl: Element | null = resolved.node.parentElement;
  while (dateEl && dateEl.localName !== 'date') {
    dateEl = dateEl.parentElement;
  }
  if (!dateEl) {
    const parentName = resolved.node.parentElement?.nodeName ?? 'unknown';
    return (
      `Anchor resolved inside <${parentName}> but there is no enclosing <date> element. ` +
      `Is this a resolve pass on untagged text?`
    );
  }

  return 'Resolve-date failed for an unknown reason.';
}

function explainFailure(
  doc: Document,
  result: ApplyResult,
  options: ApplyOptions,
): string {
  const { suggestion, outcome } = result;
  switch (outcome) {
    case 'applied':
      return '';
    case 'already-tagged':
      return `Text is already inside a <${suggestion.tag}> element.`;
    case 'schema-blocked': {
      const resolved = resolveAnchor(doc, suggestion.anchor, options.policy);
      const parent = resolved?.node.parentElement?.nodeName ?? 'unknown';
      return `Schema does not allow <${suggestion.tag}> inside <${parent}>.`;
    }
    case 'rule-blocked':
      return `Blocked by a user tagging rule for <${suggestion.tag}>.`;
    case 'unsupported-action':
      return `Unsupported action "${suggestion.action}".`;
    case 'unresolvable':
      if (suggestion.action === 'resolve-date') {
        return explainResolveDateFailure(doc, suggestion, options.policy);
      }
      return explainAnchorFailure(doc, suggestion.anchor, options.policy);
    default:
      return `Failed with outcome "${outcome}".`;
  }
}

export function buildApplyDiagnosticsReport(
  doc: Document,
  result: BatchResult,
  options: ApplyOptions,
): ApplyDiagnosticsReport {
  const byOutcome: Partial<Record<ApplyResult['outcome'], number>> = {};
  const lines: ApplyDiagnosticsLine[] = [];

  for (const row of result.results) {
    byOutcome[row.outcome] = (byOutcome[row.outcome] ?? 0) + 1;
    if (row.outcome === 'applied') continue;
    lines.push({
      suggestionId: row.suggestion.id,
      surface: row.suggestion.anchor.surface,
      action: row.suggestion.action,
      tag: row.suggestion.tag,
      outcome: row.outcome,
      reason: explainFailure(doc, row, options),
    });
  }

  const total = result.results.length;
  const applied = result.applied;
  const failed = total - applied;

  let summary: string;
  if (total === 0) {
    summary = 'Apply: no suggestions were submitted.';
  } else if (failed === 0) {
    summary = `Apply: ${applied} of ${total} suggestion(s) written to the document.`;
  } else {
    const parts = Object.entries(byOutcome)
      .filter(([outcome]) => outcome !== 'applied')
      .map(([outcome, count]) => `${count} ${outcome}`)
      .join(', ');
    summary = `Apply: ${applied} of ${total} written; ${failed} skipped (${parts}).`;
    if (lines[0]) {
      summary += ` First issue: "${lines[0].surface}" — ${lines[0].reason}`;
    }
  }

  return { applied, total, byOutcome, lines, summary };
}

export function logApplyDiagnosticsReport(report: ApplyDiagnosticsReport): void {
  console.group('[auto-tagging apply]');
  console.log(report.summary);
  if (report.lines.length > 0) {
    console.table(
      report.lines.map((line) => ({
        surface: line.surface,
        action: line.action,
        tag: line.tag,
        outcome: line.outcome,
        reason: line.reason,
      })),
    );
  }
  console.log('Full report:', report);
  console.log(
    "Tip: run localStorage.setItem('ljb.autoTaggingApplyDebug', '1') to always log apply details.",
  );
  console.groupEnd();
}

/** Attach diagnostics to a batch result and optionally log to the console. */
export function withApplyDiagnostics(
  doc: Document,
  result: BatchResult,
  options: ApplyOptions,
  opts: { forceLog?: boolean } = {},
): BatchResult & { diagnostics: ApplyDiagnosticsReport } {
  const diagnostics = buildApplyDiagnosticsReport(doc, result, options);
  const shouldLog =
    opts.forceLog || isApplyDebugEnabled() || diagnostics.applied < diagnostics.total;
  if (shouldLog) {
    logApplyDiagnosticsReport(diagnostics);
  }
  if (typeof window !== 'undefined') {
    (window as unknown as { __lastApplyDiagnostics?: ApplyDiagnosticsReport }).__lastApplyDiagnostics =
      diagnostics;
  }
  return { ...result, diagnostics };
}
