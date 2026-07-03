import { buildDocIndex } from './anchor';
import { applySuggestions, type BatchResult, type UserRule } from './apply';
import { normalizeDomText } from './normalize';
import type { Suggestion, WhitespacePolicy } from './types';

/**
 * The slice of Writer this session needs. Kept structural so the session can
 * be tested without a live editor.
 */
export interface WriterLike {
  converter: { getDocumentContent: (includeRDF: boolean) => Promise<string | null | undefined> };
  loadDocumentXML: (xml: string) => unknown;
  schemaManager?: { isTagValidChildOfParent: (child: string, parent: string) => boolean };
  editor?: {
    getBody: () => HTMLElement;
    selection: { setRng: (range: Range) => void; scrollIntoView?: () => void };
    getDoc: () => Document;
  };
  validate?: () => void;
}

/**
 * One auto-tagging run against a live document (Phase 2 integration).
 *
 * Apply strategy (decided): apply operates on the XML source — fetched from
 * the converter, mutated by the apply engine, and reloaded via
 * loadDocumentXML — the same round-trip the source editor uses. The
 * pre-apply XML string is the snapshot; revert() reloads it.
 */
export class AutoTaggingSession {
  private snapshots: string[] = [];

  constructor(
    private readonly writer: WriterLike,
    readonly policy: WhitespacePolicy = 'ignore',
  ) {}

  /** Current document as a normalized XML DOM — the input for producers. */
  async getDocument(): Promise<Document> {
    const xml = await this.writer.converter.getDocumentContent(false);
    if (!xml) throw new Error('AutoTaggingSession: could not read the current document');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    normalizeDomText(doc);
    return doc;
  }

  /**
   * Apply accepted suggestions to a fresh copy of the XML source and reload
   * the editor. Returns the apply engine's per-suggestion outcomes.
   */
  async apply(accepted: Suggestion[], userRules: UserRule[] = []): Promise<BatchResult> {
    const doc = await this.getDocument();
    const schemaManager = this.writer.schemaManager;
    const result = applySuggestions(doc, accepted, {
      policy: this.policy,
      ...(schemaManager
        ? { canContain: (parent, child) => schemaManager.isTagValidChildOfParent(child, parent) }
        : {}),
      userRules,
    });

    if (result.applied > 0) {
      this.snapshots.push(result.snapshot);
      this.writer.loadDocumentXML(new XMLSerializer().serializeToString(doc));
      this.writer.validate?.();
    }
    return result;
  }

  get canRevert(): boolean {
    return this.snapshots.length > 0;
  }

  /** Undo the most recent apply by reloading its pre-apply snapshot. */
  revertLastApply(): boolean {
    const snapshot = this.snapshots.pop();
    if (!snapshot) return false;
    this.writer.loadDocumentXML(snapshot);
    return true;
  }

  /**
   * Jump the editor to a suggestion. The editor holds a converted HTML
   * representation, so structural anchor fields don't apply; we locate the
   * surface by document-wide occurrence index in the editor body's text
   * stream (which matches the XML's, since conversion preserves text).
   * Best-effort: returns false when the editor is absent or the text differs.
   */
  focus(suggestion: Suggestion): boolean {
    const editor = this.writer.editor;
    if (!editor) return false;

    try {
      const body = editor.getBody();
      const index = buildDocIndex(body, this.policy);
      const { surface, occurrence } = suggestion.anchor;

      let seen = 0;
      for (const { node, search } of index.nodes) {
        let from = 0;
        while (true) {
          const idx = search.text.indexOf(surface, from);
          if (idx === -1) break;
          from = idx + 1;
          if (++seen < occurrence) continue;

          const start = search.map[idx]!;
          const end = search.map[idx + surface.length - 1]! + 1;
          const range = editor.getDoc().createRange();
          range.setStart(node, start);
          range.setEnd(node, end);
          editor.selection.setRng(range);
          editor.selection.scrollIntoView?.();
          (node.parentElement as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
          return true;
        }
      }
    } catch {
      // focusing is a convenience; never let it break the review walk
    }
    return false;
  }
}
