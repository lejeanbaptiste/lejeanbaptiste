import type { Suggestion, SuggestionSource } from './types';

export type Decision = 'accepted' | 'rejected';

export interface ReviewFilters {
  /** Only show suggestions from these sources. Empty set = all sources. */
  sources: Set<SuggestionSource>;
  /** Only show suggestions with confidence >= this (undefined confidence always shows). */
  minConfidence: number;
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
 * Framework-free state machine for the shared review walk. All auto-tagging
 * methods feed batches of suggestions through this one controller; the UI
 * renders its state and forwards commands.
 *
 * Navigation (j/k) moves only among pending items. Accepted and rejected items
 * are shown separately in the UI but remain in the batch until applied.
 */
export class ReviewController {
  private suggestions: Suggestion[];
  private filters: ReviewFilters = { sources: new Set(), minConfidence: 0 };
  /** Index into {@link pendingVisible}. */
  private cursorPendingIndex = -1;
  private readonly options: ReviewControllerOptions;

  constructor(suggestions: Suggestion[], options: ReviewControllerOptions = {}) {
    this.suggestions = [...suggestions];
    this.options = options;
    if (this.pendingVisible().length > 0) this.moveToPendingIndex(0);
  }

  /** Suggestions passing the current filters, in batch order. */
  visible(): Suggestion[] {
    return this.suggestions.filter(
      (s) =>
        (this.filters.sources.size === 0 || this.filters.sources.has(s.source)) &&
        (s.confidence === undefined || s.confidence >= this.filters.minConfidence),
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

  current(): Suggestion | null {
    return this.pendingVisible()[this.cursorPendingIndex] ?? null;
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
    if (this.cursorPendingIndex < this.pendingVisible().length - 1) {
      this.moveToPendingIndex(this.cursorPendingIndex + 1);
    }
  }

  previous() {
    if (this.cursorPendingIndex > 0) {
      this.moveToPendingIndex(this.cursorPendingIndex - 1);
    }
  }

  moveToPendingIndex(index: number) {
    const pending = this.pendingVisible();
    if (index < 0 || index >= pending.length) return;
    this.cursorPendingIndex = index;
    this.options.onFocus?.(pending[index]!);
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

  /** Decide the current pending suggestion and advance. */
  decide(decision: Decision) {
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
    const index = this.pendingVisible().findIndex((s) => s.id === suggestion.id);
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
    for (const s of this.pending()) {
      // Undecided alternatives: the first in batch order wins the span.
      if (s.status !== 'pending') continue;
      s.status = 'accepted';
      this.options.onDecision?.({ suggestion: s, decision: 'accepted' });
      this.rejectAlternativesOf(s);
    }
    return this.takeAccepted();
  }

  private advanceToPending() {
    const pending = this.pendingVisible();
    if (pending.length === 0) {
      this.cursorPendingIndex = -1;
      return;
    }
    if (this.cursorPendingIndex >= pending.length) {
      this.cursorPendingIndex = pending.length - 1;
    }
    this.moveToPendingIndex(this.cursorPendingIndex);
  }

  private clampCursor() {
    const pending = this.pendingVisible();
    if (pending.length === 0) {
      this.cursorPendingIndex = -1;
      return;
    }
    this.cursorPendingIndex = Math.min(Math.max(this.cursorPendingIndex, 0), pending.length - 1);
  }
}

export interface ReviewKeyModifiers {
  shift?: boolean;
}

/**
 * Keyboard model for the review walk:
 * j/↓ next · k/↑ previous · Enter accept · Shift+Enter accept all identical ·
 * Backspace/Delete reject · Shift+Backspace reject all identical ·
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
