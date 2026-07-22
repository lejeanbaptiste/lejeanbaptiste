import { compareAnchorsByDocumentPosition } from './anchor';
import type { Suggestion, SuggestionSource } from './types';

function sortSuggestionsByDocumentPosition(suggestions: Suggestion[]): Suggestion[] {
  return [...suggestions].sort((left, right) =>
    compareAnchorsByDocumentPosition(left.anchor, right.anchor),
  );
}

export type Decision = 'accepted' | 'rejected';

export interface ReviewFilters {
  /** Only show suggestions from these sources. Empty set = all sources. */
  sources: Set<SuggestionSource>;
  /** Only show suggestions with confidence >= this (undefined confidence always shows). */
  minConfidence: number;
  /** Only show suggestions for this TEI tag. Null = all tags. */
  tag: string | null;
}

export interface DecisionEvent {
  suggestion: Suggestion;
  decision: Decision;
}

export interface ReviewControllerOptions {
  /** Called on every accept/reject — feeds the decision log (Phase 3). */
  onDecision?: (event: DecisionEvent) => void;
  /** Called when the cursor moves to a suggestion — host jumps the editor there. */
  onFocus?: (suggestion: Suggestion) => void;
}

/**
 * A navigation stop in the pending list. Length 1 for an ordinary suggestion.
 * Length > 1 when several same-span 'add' suggestions with different tags
 * compete for the same text (e.g. one string offered as both persName and
 * roleName) — j/k, Enter, and Backspace treat the whole group as one unit;
 * `selectedIndex` is which alternative Enter currently accepts.
 */
export interface PendingGroup {
  suggestions: Suggestion[];
  selectedIndex: number;
}

/** Same-span 'add' suggestions with different tags share this key. */
function alternativeGroupKey(s: Suggestion): string | null {
  if (s.action !== 'add') return null;
  return `${s.anchor.xpath}\t${s.anchor.offset}\t${s.anchor.surface}`;
}

/**
 * Framework-free state machine for the shared review walk. All auto-tagging
 * methods feed batches of suggestions through this one controller; the UI
 * renders its state and forwards commands.
 *
 * Navigation (j/k) moves only among pending items. Accepted and rejected items
 * are shown separately in the UI but remain in the batch until applied.
 */
export class ReviewController {
  private suggestions: Suggestion[];
  private filters: ReviewFilters = { sources: new Set(), minConfidence: 0, tag: null };
  /** Index into {@link pendingGroups}. */
  private cursorPendingIndex = -1;
  /** Which alternative is selected within each alternative group, keyed by group key. */
  private readonly groupSelection = new Map<string, number>();
  private readonly options: ReviewControllerOptions;

  constructor(suggestions: Suggestion[], options: ReviewControllerOptions = {}) {
    this.suggestions = sortSuggestionsByDocumentPosition(suggestions);
    this.options = options;
    if (this.pendingGroups().length > 0) this.moveToPendingIndex(0);
  }

  /** Partition a suggestion list into navigation stops (see {@link PendingGroup}). */
  private groupsOf(list: Suggestion[]): Suggestion[][] {
    const byKey = new Map<string, Suggestion[]>();
    const order: string[] = [];
    for (const s of list) {
      const key = alternativeGroupKey(s) ?? `\0solo:${s.id}`;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = [];
        byKey.set(key, bucket);
        order.push(key);
      }
      bucket.push(s);
    }
    const groups: Suggestion[][] = [];
    for (const key of order) {
      const bucket = byKey.get(key)!;
      // Only a real alternative group when the bucket actually carries >1 distinct tag.
      if (bucket.length > 1 && new Set(bucket.map((s) => s.tag)).size > 1) {
        groups.push(bucket);
      } else {
        for (const item of bucket) groups.push([item]);
      }
    }
    return groups;
  }

  private selectedIndexFor(group: Suggestion[]): number {
    if (group.length <= 1) return 0;
    const key = alternativeGroupKey(group[0]!)!;
    const stored = this.groupSelection.get(key) ?? 0;
    return Math.min(Math.max(stored, 0), group.length - 1);
  }

  /** Pending suggestions grouped into navigation stops, in document order. */
  pendingGroups(): PendingGroup[] {
    return this.groupsOf(this.pendingVisible()).map((suggestions) => ({
      suggestions,
      selectedIndex: this.selectedIndexFor(suggestions),
    }));
  }

  private currentGroup(): PendingGroup | null {
    return this.pendingGroups()[this.cursorPendingIndex] ?? null;
  }

  /** Select which alternative within `suggestion`'s group Enter will accept. */
  selectAlternative(suggestion: Suggestion) {
    const key = alternativeGroupKey(suggestion);
    if (!key) return;
    const group = this.currentGroup();
    if (!group || !group.suggestions.includes(suggestion)) return;
    const index = group.suggestions.indexOf(suggestion);
    this.groupSelection.set(key, index);
  }

  /** Cycle the selected alternative in the current group (keyboard: space). */
  cycleAlternative() {
    const group = this.currentGroup();
    if (!group || group.suggestions.length <= 1) return;
    const key = alternativeGroupKey(group.suggestions[0]!)!;
    const next = (group.selectedIndex + 1) % group.suggestions.length;
    this.groupSelection.set(key, next);
  }

  /** Suggestions passing the current filters, in batch order. */
  visible(): Suggestion[] {
    return this.suggestions.filter(
      (s) =>
        (this.filters.sources.size === 0 || this.filters.sources.has(s.source)) &&
        (s.confidence === undefined || s.confidence >= this.filters.minConfidence) &&
        (!this.filters.tag || s.tag === this.filters.tag),
    );
  }

  pendingVisible(): Suggestion[] {
    return this.visible().filter((s) => s.status === 'pending');
  }

  acceptedVisible(): Suggestion[] {
    return this.visible().filter((s) => s.status === 'accepted');
  }

  rejectedVisible(): Suggestion[] {
    return this.visible().filter((s) => s.status === 'rejected');
  }

  /** Visible suggestions still awaiting a decision. */
  pending(): Suggestion[] {
    return this.pendingVisible();
  }

  accepted(): Suggestion[] {
    return this.suggestions.filter((s) => s.status === 'accepted');
  }

  /** The selected suggestion within the current group (single item for ordinary suggestions). */
  current(): Suggestion | null {
    const group = this.currentGroup();
    if (!group) return null;
    return group.suggestions[group.selectedIndex] ?? group.suggestions[0] ?? null;
  }

  counts() {
    const all = this.suggestions;
    return {
      total: all.length,
      pending: all.filter((s) => s.status === 'pending').length,
      accepted: all.filter((s) => s.status === 'accepted').length,
      rejected: all.filter((s) => s.status === 'rejected').length,
      unresolvable: all.filter((s) => s.status === 'unresolvable').length,
    };
  }

  setFilters(filters: Partial<ReviewFilters>) {
    this.filters = { ...this.filters, ...filters };
    this.clampCursor();
  }

  next() {
    if (this.cursorPendingIndex < this.pendingGroups().length - 1) {
      this.moveToPendingIndex(this.cursorPendingIndex + 1);
    }
  }

  previous() {
    if (this.cursorPendingIndex > 0) {
      this.moveToPendingIndex(this.cursorPendingIndex - 1);
    }
  }

  /** Move the cursor to a stop in {@link pendingGroups} (one alternative-group counts as one stop). */
  moveToPendingIndex(index: number) {
    const groups = this.pendingGroups();
    if (index < 0 || index >= groups.length) return;
    this.cursorPendingIndex = index;
    const group = groups[index]!;
    this.options.onFocus?.(group.suggestions[group.selectedIndex] ?? group.suggestions[0]!);
  }

  /** Jump the editor to a suggestion without moving the pending cursor. */
  preview(suggestion: Suggestion) {
    this.options.onFocus?.(suggestion);
  }

  /**
   * Same-span 'add' suggestions with different tags are mutually exclusive
   * alternatives (one string offered as e.g. both persName and title).
   */
  private isAlternative(a: Suggestion, b: Suggestion): boolean {
    return (
      a !== b &&
      a.action === 'add' &&
      b.action === 'add' &&
      a.tag !== b.tag &&
      a.anchor.xpath === b.anchor.xpath &&
      a.anchor.offset === b.anchor.offset &&
      a.anchor.surface === b.anchor.surface
    );
  }

  /** Accepting one alternative rejects the others — only one tag can win the span. */
  private rejectAlternativesOf(accepted: Suggestion) {
    for (const s of this.suggestions) {
      if (!this.isAlternative(accepted, s)) continue;
      if (s.status !== 'pending' && s.status !== 'accepted') continue;
      s.status = 'rejected';
      this.options.onDecision?.({ suggestion: s, decision: 'rejected' });
    }
  }

  /**
   * Decide the current pending stop and advance. For an alternative group,
   * Enter accepts the selected alternative (rejecting its siblings via
   * {@link rejectAlternativesOf}); Backspace rejects the whole group — there's
   * one accept/reject decision for the pair, not one per alternative.
   */
  decide(decision: Decision) {
    const group = this.currentGroup();
    if (!group) return;

    if (decision === 'rejected' && group.suggestions.length > 1) {
      for (const s of group.suggestions) {
        if (s.status === 'unresolvable') continue;
        s.status = 'rejected';
        this.options.onDecision?.({ suggestion: s, decision: 'rejected' });
      }
      this.advanceToPending();
      return;
    }

    const current = this.current();
    if (!current || current.status === 'unresolvable') return;
    current.status = decision;
    this.options.onDecision?.({ suggestion: current, decision });
    if (decision === 'accepted') this.rejectAlternativesOf(current);
    this.advanceToPending();
  }

  accept() {
    this.decide('accepted');
  }

  reject() {
    this.decide('rejected');
  }

  /**
   * Accept every pending suggestion with the same surface and tag as the
   * current item (document-scoped bulk accept — identical string ≠ identical entity,
   * but the user explicitly asked for this shortcut).
   */
  acceptAllIdenticalStrings() {
    const current = this.current();
    if (!current) return;
    const { surface } = current.anchor;
    const { tag } = current;
    for (const s of this.pendingVisible()) {
      if (s.anchor.surface === surface && s.tag === tag) {
        s.status = 'accepted';
        this.options.onDecision?.({ suggestion: s, decision: 'accepted' });
        this.rejectAlternativesOf(s);
      }
    }
    this.advanceToPending();
  }

  /**
   * Reject every pending suggestion with the same surface and tag as the
   * current item (mirror of acceptAllIdenticalStrings).
   */
  rejectAllIdenticalStrings() {
    const current = this.current();
    if (!current) return;
    const { surface } = current.anchor;
    const { tag } = current;
    for (const s of this.pendingVisible()) {
      if (s.anchor.surface === surface && s.tag === tag) {
        s.status = 'rejected';
        this.options.onDecision?.({ suggestion: s, decision: 'rejected' });
      }
    }
    this.advanceToPending();
  }

  /** Flip an already-decided suggestion to the other outcome. */
  changeDecision(suggestion: Suggestion, decision: Decision) {
    if (suggestion.status === 'unresolvable' || suggestion.status === 'pending') return;
    if (suggestion.status === decision) return;
    suggestion.status = decision;
    this.options.onDecision?.({ suggestion, decision });
    if (decision === 'accepted') this.rejectAlternativesOf(suggestion);
  }

  /** Revert the current pending suggestion's decision (only meaningful before apply). */
  undecide() {
    const current = this.current();
    if (!current || (current.status !== 'accepted' && current.status !== 'rejected')) return;
    current.status = 'pending';
    this.clampCursor();
  }

  /** Restore a decided suggestion from an accepted/rejected group back to pending. */
  undecideSuggestion(suggestion: Suggestion) {
    if (suggestion.status !== 'accepted' && suggestion.status !== 'rejected') return;
    suggestion.status = 'pending';
    const index = this.pendingGroups().findIndex((g) =>
      g.suggestions.some((s) => s.id === suggestion.id),
    );
    if (index >= 0) this.moveToPendingIndex(index);
    else this.clampCursor();
  }

  /** Accept every pending visible suggestion at or above the confidence threshold. */
  acceptAllAbove(confidence: number) {
    for (const s of this.pending()) {
      if (s.status !== 'pending') continue; // rejected as an alternative earlier in this loop
      if (s.confidence !== undefined && s.confidence >= confidence) {
        s.status = 'accepted';
        this.options.onDecision?.({ suggestion: s, decision: 'accepted' });
        this.rejectAlternativesOf(s);
      }
    }
    this.clampCursor();
  }

  takeAccepted(): Suggestion[] {
    const accepted = this.accepted();
    this.suggestions = this.suggestions.filter((s) => s.status !== 'accepted');
    this.clampCursor();
    return accepted;
  }

  takeAllExceptRejected(): Suggestion[] {
    // Snapshot first: statuses change as we go, and pendingGroups() is derived live.
    for (const group of this.pendingGroups()) {
      const winner = group.suggestions[group.selectedIndex] ?? group.suggestions[0]!;
      if (winner.status !== 'pending') continue;
      winner.status = 'accepted';
      this.options.onDecision?.({ suggestion: winner, decision: 'accepted' });
      this.rejectAlternativesOf(winner);
    }
    return this.takeAccepted();
  }

  private advanceToPending() {
    const groups = this.pendingGroups();
    if (groups.length === 0) {
      this.cursorPendingIndex = -1;
      return;
    }
    if (this.cursorPendingIndex >= groups.length) {
      this.cursorPendingIndex = groups.length - 1;
    }
    this.moveToPendingIndex(this.cursorPendingIndex);
  }

  private clampCursor() {
    const groups = this.pendingGroups();
    if (groups.length === 0) {
      this.cursorPendingIndex = -1;
      return;
    }
    this.cursorPendingIndex = Math.min(Math.max(this.cursorPendingIndex, 0), groups.length - 1);
  }
}

export interface ReviewKeyModifiers {
  shift?: boolean;
}

/**
 * Keyboard model for the review walk:
 * j/↓ next · k/↑ previous · Enter accept · Shift+Enter accept all identical ·
 * Backspace/Delete reject (whole pair, for alternative groups) · Shift+Backspace
 * reject all identical · Space cycle the selected alternative in a group ·
 * a/r/x/u aliases · u undecide (current pending only).
 */
export function handleReviewKey(
  controller: ReviewController,
  key: string,
  modifiers: ReviewKeyModifiers = {},
): boolean {
  switch (key) {
    case 'j':
    case 'ArrowDown':
      controller.next();
      return true;
    case 'k':
    case 'ArrowUp':
      controller.previous();
      return true;
    case ' ':
    case 'Spacebar':
      controller.cycleAlternative();
      return true;
    case 'Enter':
      if (modifiers.shift) controller.acceptAllIdenticalStrings();
      else controller.accept();
      return true;
    case 'a':
      controller.accept();
      return true;
    case 'r':
    case 'x':
      controller.reject();
      return true;
    case 'Backspace':
    case 'Delete':
      if (modifiers.shift) controller.rejectAllIdenticalStrings();
      else controller.reject();
      return true;
    case 'u':
      controller.undecide();
      return true;
    default:
      return false;
  }
}
