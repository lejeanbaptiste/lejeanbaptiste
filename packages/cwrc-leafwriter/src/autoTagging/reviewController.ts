import type { Suggestion, SuggestionSource } from './types';

export type Decision = 'accepted' | 'rejected';

export interface ReviewFilters {
  /** Only show suggestions from these sources. Empty set = all sources. */
  sources: Set<SuggestionSource>;
  /** Only show suggestions with confidence >= this (undefined confidence always shows). */
  minConfidence: number;
}

export interface ReviewState {
  suggestions: Suggestion[];
  filters: ReviewFilters;
  /** Index into the *filtered* list. -1 when the list is empty. */
  cursor: number;
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
 * Semantics (Phase 1 decisions):
 * - Partial apply is allowed: accepted items can be applied at any time,
 *   pending ones survive.
 * - Rejections are kept (status 'rejected'), not discarded, and reported via
 *   onDecision for the decision log.
 * - Decisions are revocable until applied (undecide()).
 */
export class ReviewController {
  private suggestions: Suggestion[];
  private filters: ReviewFilters = { sources: new Set(), minConfidence: 0 };
  private cursorIndex = -1;
  private readonly options: ReviewControllerOptions;

  constructor(suggestions: Suggestion[], options: ReviewControllerOptions = {}) {
    this.suggestions = [...suggestions];
    this.options = options;
    if (this.visible().length > 0) this.moveTo(0);
  }

  /** Suggestions passing the current filters, in batch order. */
  visible(): Suggestion[] {
    return this.suggestions.filter(
      (s) =>
        (this.filters.sources.size === 0 || this.filters.sources.has(s.source)) &&
        (s.confidence === undefined || s.confidence >= this.filters.minConfidence),
    );
  }

  /** Visible suggestions still awaiting a decision. */
  pending(): Suggestion[] {
    return this.visible().filter((s) => s.status === 'pending');
  }

  accepted(): Suggestion[] {
    return this.suggestions.filter((s) => s.status === 'accepted');
  }

  current(): Suggestion | null {
    return this.visible()[this.cursorIndex] ?? null;
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
    if (this.cursorIndex < this.visible().length - 1) this.moveTo(this.cursorIndex + 1);
  }

  previous() {
    if (this.cursorIndex > 0) this.moveTo(this.cursorIndex - 1);
  }

  moveTo(index: number) {
    const visible = this.visible();
    if (index < 0 || index >= visible.length) return;
    this.cursorIndex = index;
    const current = visible[index]!;
    this.options.onFocus?.(current);
  }

  /** Decide the current suggestion and advance to the next pending one. */
  decide(decision: Decision) {
    const current = this.current();
    if (!current || current.status === 'unresolvable') return;
    current.status = decision;
    this.options.onDecision?.({ suggestion: current, decision });
    this.advanceToPending();
  }

  accept() {
    this.decide('accepted');
  }

  reject() {
    this.decide('rejected');
  }

  /** Revert the current suggestion's decision (only meaningful before apply). */
  undecide() {
    const current = this.current();
    if (!current || (current.status !== 'accepted' && current.status !== 'rejected')) return;
    current.status = 'pending';
  }

  /** Accept every pending visible suggestion at or above the confidence threshold. */
  acceptAllAbove(confidence: number) {
    for (const s of this.pending()) {
      if (s.confidence !== undefined && s.confidence >= confidence) {
        s.status = 'accepted';
        this.options.onDecision?.({ suggestion: s, decision: 'accepted' });
      }
    }
    this.clampCursor();
  }

  /**
   * Hand the accepted suggestions to the caller (who runs the apply engine)
   * and drop them from the walk. Pending and rejected items remain, so review
   * can continue — partial apply.
   */
  takeAccepted(): Suggestion[] {
    const accepted = this.accepted();
    this.suggestions = this.suggestions.filter((s) => s.status !== 'accepted');
    this.clampCursor();
    return accepted;
  }

  private advanceToPending() {
    const visible = this.visible();
    for (let i = this.cursorIndex + 1; i < visible.length; i++) {
      if (visible[i]!.status === 'pending') return this.moveTo(i);
    }
    for (let i = 0; i < visible.length; i++) {
      if (visible[i]!.status === 'pending') return this.moveTo(i);
    }
    // nothing pending: stay put (clamped)
    this.clampCursor();
  }

  private clampCursor() {
    const visible = this.visible();
    if (visible.length === 0) {
      this.cursorIndex = -1;
      return;
    }
    this.cursorIndex = Math.min(Math.max(this.cursorIndex, 0), visible.length - 1);
  }
}

/**
 * Map a keyboard event to a controller command. One shared keyboard model
 * for the whole review walk (mirrors find-and-replace conventions):
 * j/↓ next · k/↑ previous · a/Enter accept · r/x reject · u undecide.
 * Returns true when the key was handled.
 */
export function handleReviewKey(controller: ReviewController, key: string): boolean {
  switch (key) {
    case 'j':
    case 'ArrowDown':
      controller.next();
      return true;
    case 'k':
    case 'ArrowUp':
      controller.previous();
      return true;
    case 'a':
    case 'Enter':
      controller.accept();
      return true;
    case 'r':
    case 'x':
      controller.reject();
      return true;
    case 'u':
      controller.undecide();
      return true;
    default:
      return false;
  }
}
