import { buildDocIndex } from './anchor';
import { dateCuratorDisplaySurface } from './dateCurator';
import {
  applySuggestions,
  assignEntity,
  markUnresolved as markMentionUnresolved,
  type BatchResult,
  type UserRule,
} from './apply';
import { withApplyDiagnostics } from './applyDiagnostics';
import { canContainForAutoTagging } from './schemaContainment';
import { AuthorityCache } from './authorityCache';
import { DilaPlaceDetailCache } from './dilaPlaceDetailCache';
import type { DisambiguationCandidate } from './disambiguationCandidates';
import { resolveEntityInDocument } from './disambiguationCandidates';
import {
  parsePendingCache,
  serializePendingCache,
  setPendingCandidates,
  type PendingCache,
} from './disambiguationPending';
import { DecisionLogBuffer, type DecisionRecord } from './decisionLog';
import { LJB_AUTOTAG_RESP, TAG_TO_KIND, type EntityKind } from './entities';
import { entityStoreFromDesktop, type EntityStore } from './entityStore';
import { DisambiguationAiCache } from './disambiguationAiCache';
import type { AiPromptProfile } from './aiPromptProfiles';
import type { LlmClient } from './llmClient';
import { LlmCache } from './llmCache';
import { llmSuggest, type LlmSuggestResult } from './llmSuggest';
import { filterNestedSameTagAdds } from './suggestionFilters';
import { llmAudit, collectTaggedSpans, type LlmAuditResult } from './llmAudit';
import { normalizeDomText } from './normalize';
import type { AuthorityPackId } from './packPaths';
import { MAX_AUTHORITY_SUGGESTIONS, runAuthorityTagBombOnDocument } from './authorityTagBomb';
import {
  dateTagOnlyFromSanmiao,
  dateResolveFromDocument,
  type DateTagOptions,
  type SanmiaoBatchResolveFn,
  type SanmiaoBatchTagFn,
} from './dates';
import {
  collectMentions,
  mergeMentionGroups,
  type MentionGroup,
  type MentionInstance,
} from './mentions';
import type { DecisionEvent } from './reviewController';
import type { Suggestion, WhitespacePolicy } from './types';
import type { DateRangeFilter } from './packLoader';
import type { SearchTextRange } from './chunk';
import { findSelectionRangeInDocument, searchTextForDomRange } from './selectionScope';

export { MAX_AUTHORITY_SUGGESTIONS } from './authorityTagBomb';

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
    isNotDirty?: boolean;
    selection: {
      setRng: (range: Range) => void;
      getRng?: () => Range | null;
      scrollIntoView?: () => void;
    };
    getDoc: () => Document;
  };
  overmindActions?: {
    editor?: { setContentHasChanged?: (value: boolean) => void };
    project?: {
      markTabDirty?: (dirty: boolean) => void;
      updateTabContent?: (params: { content: string; filePath: string }) => void;
    };
  };
  overmindState?: {
    document?: { url?: string };
    editor?: { resource?: { filePath?: string } };
  };
  validate?: () => void;
}

/** Desktop file access for project-wide crawl (absent in the web app). */
interface DesktopProjectApi {
  listProjectXmlFiles: (rootPath: string) => Promise<{ name: string; path: string }[]>;
  readFile: (filePath: string) => Promise<string>;
}

export interface ProjectDocuments {
  /** The current (live) document plus every readable project XML file. */
  documents: Document[];
  /** True when a filesystem project was available (desktop app). */
  available: boolean;
}

/** Compare filesystem paths case-insensitively, normalizing separators. */
function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
}

export type ApplyProgressCallback = (done: number, total: number) => void;

/** Let the browser paint a progress overlay before heavy synchronous work. */
const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

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
  private readonly decisions = new DecisionLogBuffer();
  private readonly store: EntityStore | null;
  private entitiesDoc: Document | null = null;
  private authorityCache: AuthorityCache | null = null;
  private dilaPlaceDetailCacheStore: DilaPlaceDetailCache | null = null;
  private llmCache: LlmCache | null = null;
  private disambiguationAiCacheStore: DisambiguationAiCache | null = null;
  private pendingCache: PendingCache = { version: 1, entries: {} };
  private documentPaths = new Map<Document, string>();

  constructor(
    private readonly writer: WriterLike,
    readonly policy: WhitespacePolicy = 'ignore',
    store: EntityStore | null = entityStoreFromDesktop(),
  ) {
    this.store = store;
    if (store) {
      const globals = window as unknown as {
        electronAPI?: {
          readFile: (path: string) => Promise<string>;
          writeFile: (path: string, content: string) => Promise<void>;
          pathExists: (path: string) => Promise<boolean>;
          ensureDirectory: (dir: string) => Promise<void>;
        };
      };
      const api = globals.electronAPI;
      if (api) {
        this.authorityCache = new AuthorityCache(api, store.authorityCacheDir, {
          enableGlobalCache: true,
        });
        this.dilaPlaceDetailCacheStore = new DilaPlaceDetailCache(
          api,
          store.dilaPlaceDetailCacheDir,
        );
        this.llmCache = new LlmCache(api, store.aiCacheDir);
        this.disambiguationAiCacheStore = new DisambiguationAiCache(
          api,
          store.aiDisambiguationCacheDir,
        );
      }
    }
  }

  get entityStore(): EntityStore | null {
    return this.store;
  }

  get cache(): AuthorityCache | null {
    return this.authorityCache;
  }

  get dilaPlaceDetailCache(): DilaPlaceDetailCache | null {
    return this.dilaPlaceDetailCacheStore;
  }

  get aiCache(): LlmCache | null {
    return this.llmCache;
  }

  get disambiguationAiCache(): DisambiguationAiCache | null {
    return this.disambiguationAiCacheStore;
  }

  /**
   * The current editor selection as a whole-document search-text range, for
   * scoping producers to the selected blocks. Null when nothing is selected
   * or the selected text cannot be located in the serialized document (the
   * caller then runs on the whole document).
   */
  async getSelectionRange(): Promise<SearchTextRange | null> {
    const editor = this.writer.editor;
    const range = editor?.selection.getRng?.();
    if (!editor || !range || range.collapsed) return null;

    try {
      const bodyIndex = buildDocIndex(editor.getBody(), this.policy);
      const selected = searchTextForDomRange(bodyIndex, range);
      const doc = await this.getDocument();
      return findSelectionRangeInDocument(doc, selected, this.policy);
    } catch {
      // Selection scoping is a convenience — never let it block a run.
      return null;
    }
  }

  /**
   * Run AI suggest on the live document. Uses `.ljb/ai-cache/` when a project
   * store is available. `onProgress` reports completed chunk count. Pass
   * `range` (from getSelectionRange) to tag only the blocks it intersects.
   */
  async runAiSuggest(
    tags: string[],
    client: LlmClient,
    onProgress?: (done: number, total: number) => void,
    promptProfile?: AiPromptProfile,
    signal?: AbortSignal,
    range?: SearchTextRange | null,
    onChunk?: (suggestions: Suggestion[]) => void,
  ): Promise<LlmSuggestResult> {
    const doc = await this.getDocument();
    const result = await llmSuggest(doc, {
      tags,
      client,
      cache: this.llmCache ?? undefined,
      policy: this.policy,
      onProgress,
      promptProfile,
      signal,
      range,
      onChunk,
    });
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, this.policy, result.suggestions);
    return {
      suggestions,
      unverifiableCount: result.unverifiableCount + dropped,
    };
  }

  /**
   * Run AI audit on the live document (existing tags rendered inline per chunk).
   * Uses `.ljb/ai-cache/` when a project store is available.
   */
  async runAiAudit(
    tags: string[],
    client: LlmClient,
    onProgress?: (done: number, total: number) => void,
    promptProfile?: AiPromptProfile,
    signal?: AbortSignal,
    range?: SearchTextRange | null,
    onChunk?: (suggestions: Suggestion[]) => void,
  ): Promise<LlmAuditResult> {
    const doc = await this.getDocument();
    const result = await llmAudit(doc, {
      tags,
      client,
      cache: this.llmCache ?? undefined,
      policy: this.policy,
      onProgress,
      promptProfile,
      signal,
      range,
      onChunk,
    });
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, this.policy, result.suggestions);
    return {
      ...result,
      suggestions,
      unverifiableCount: result.unverifiableCount + dropped,
    };
  }

  /** True when the document has at least one tagged mention for any of `tags`. */
  async hasTaggedMentions(tags: string[]): Promise<boolean> {
    const doc = await this.getDocument();
    const index = buildDocIndex(doc, this.policy);
    return collectTaggedSpans(doc, index, new Set(tags)).length > 0;
  }

  /**
   * Tag bomb from pre-compiled authority NDJSON packs (Phase A2/A3).
   * Tag-only — no @key; clues on suggestions for review / later disambiguation.
   */
  async runAuthorityTagBomb(
    packIds: AuthorityPackId[],
    readPackFile: (packId: AuthorityPackId) => Promise<string>,
    options: {
      dateFilter?: DateRangeFilter;
      /** @deprecated Use {@link dateFilter}. */
      yearRange?: { start: number; end: number };
      hideUndated?: boolean;
      onProgress?: (message: string) => void;
    } = {},
  ): Promise<{
    suggestions: Suggestion[];
    candidateCount: number;
    matchCount: number;
    loaded: Partial<Record<AuthorityPackId, number>>;
    truncated: boolean;
  }> {
    const doc = await this.getDocument();
    const result = await runAuthorityTagBombOnDocument(doc, packIds, readPackFile, this.policy, {
      ...options,
      maxSuggestions: MAX_AUTHORITY_SUGGESTIONS,
      onProgress: (message) => {
        options.onProgress?.(message);
        void yieldToUi();
      },
    });
    return result;
  }

  async runEastAsianDateTag(
    batchTag: SanmiaoBatchTagFn,
    options: DateTagOptions = {},
  ): Promise<{ suggestions: Suggestion[]; proposalCount: number }> {
    const doc = await this.getDocument();
    const suggestions = await dateTagOnlyFromSanmiao(doc, this.policy, batchTag, options);
    return { suggestions, proposalCount: suggestions.length };
  }

  async runEastAsianDateResolve(
    batchResolve: SanmiaoBatchResolveFn,
    options: DateTagOptions = {},
  ): Promise<{ suggestions: Suggestion[]; proposalCount: number }> {
    const doc = await this.getDocument();
    const suggestions = await dateResolveFromDocument(doc, this.policy, batchResolve, options);
    return { suggestions, proposalCount: suggestions.length };
  }

  /** @deprecated Use {@link runEastAsianDateTag}. */
  async runEastAsianDates(
    batchTag: SanmiaoBatchTagFn,
    options: DateTagOptions = {},
  ): Promise<{ suggestions: Suggestion[]; proposalCount: number }> {
    return this.runEastAsianDateTag(batchTag, options);
  }

  /**
   * Record a review-walk decision for the decision log. Wire this to
   * `ReviewController.onDecision` (or ReviewPanel's `onDecision` prop).
   */
  logDecision(event: DecisionEvent): void {
    this.decisions.add(event);
  }

  get pendingDecisionCount(): number {
    return this.decisions.length;
  }

  /**
   * Flush buffered decisions to `/.ljb/entity-decisions.jsonl`. No-op (but
   * still clears the buffer) in the web app where no project store exists.
   * Returns the number of records written.
   */
  async flushDecisions(): Promise<number> {
    const records = this.decisions.pending;
    if (records.length === 0) return 0;
    if (this.store) await this.store.appendDecisions(records);
    this.decisions.flush(); // clear the buffer regardless
    return records.length;
  }

  /** Current document as a normalized XML DOM — the input for producers. */
  async getDocument(): Promise<Document> {
    const xml = await this.writer.converter.getDocumentContent(false);
    if (!xml) throw new Error('AutoTaggingSession: could not read the current document');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    normalizeDomText(doc);
    return doc;
  }

  /**
   * The current document plus every XML file in the project (desktop only),
   * for project-wide crawl. In the web app, or with no project open, returns
   * just the current document with `available: false`. Unreadable or malformed
   * files are skipped.
   */
  async getProjectDocuments(): Promise<ProjectDocuments> {
    const current = await this.getDocument();

    const globals = window as unknown as {
      electronAPI?: Partial<DesktopProjectApi>;
      __ljbLspProject?: { projectRoot?: string };
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
    };
    const api = globals.electronAPI;
    const root = globals.__ljbLspProject?.projectRoot;
    if (!api?.listProjectXmlFiles || !api.readFile || !root) {
      return { documents: [current], available: false };
    }

    const activePath = globals.writer?.overmindState?.editor?.resource?.filePath;
    const documents = [current];
    this.documentPaths.set(current, activePath ?? 'current');
    const files = await api.listProjectXmlFiles(root);
    for (const file of files) {
      if (activePath && samePath(file.path, activePath)) continue;
      try {
        const xml = await api.readFile(file.path);
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) continue;
        normalizeDomText(doc);
        documents.push(doc);
        this.documentPaths.set(doc, file.path);
      } catch {
        // skip files that can't be read or parsed
      }
    }
    return { documents, available: true };
  }

  async loadEntities(): Promise<Document> {
    if (!this.store) throw new Error('No entity store available');
    this.entitiesDoc = await this.store.loadEntities();
    const pending = await this.store.readDisambiguationPending();
    this.pendingCache = parsePendingCache(pending);
    return this.entitiesDoc;
  }

  async saveEntities(): Promise<void> {
    if (!this.store || !this.entitiesDoc) return;
    await this.store.saveEntities(this.entitiesDoc);
  }

  async savePendingCache(): Promise<void> {
    if (!this.store) return;
    await this.store.writeDisambiguationPending(serializePendingCache(this.pendingCache));
  }

  getEntitiesDocument(): Document | null {
    return this.entitiesDoc;
  }

  getPendingCandidates(tag: string, surface: string): DisambiguationCandidate[] | null {
    return this.pendingCache.entries[`${tag}\0${surface}`]?.candidates ?? null;
  }

  rememberPendingCandidates(
    tag: string,
    surface: string,
    candidates: DisambiguationCandidate[],
  ): void {
    this.pendingCache = setPendingCandidates(this.pendingCache, tag, surface, candidates);
  }

  /** Scan corpus XML for mentions needing disambiguation (current document by default). */
  async scanMentions(
    options: {
      includeResolved?: boolean;
      /** `current` = open editor file only; `project` = every project XML file. */
      scope?: 'current' | 'project';
      onProgress?: (done: number, total: number) => void;
    } = {},
  ): Promise<MentionGroup[]> {
    const scope = options.scope ?? 'current';

    if (scope === 'current') {
      options.onProgress?.(0, 1);
      const doc = await this.getDocument();
      const globals = window as unknown as {
        writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
      };
      const documentId = globals.writer?.overmindState?.editor?.resource?.filePath ?? 'current';
      this.documentPaths.set(doc, documentId);
      const groups = collectMentions(doc, this.policy, documentId, options);
      options.onProgress?.(1, 1);
      return groups;
    }

    const { documents } = await this.getProjectDocuments();
    const total = documents.length;
    const groups: MentionGroup[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]!;
      options.onProgress?.(i, total);
      groups.push(
        ...collectMentions(doc, this.policy, this.documentPaths.get(doc) ?? `doc-${i}`, options),
      );
      if (i < documents.length - 1) await yieldToUi();
    }

    options.onProgress?.(total, total);
    return mergeMentionGroups(groups);
  }

  /**
   * loadDocumentXML clears dirty state via documentLoaded. Restore unsaved
   * tracking and in-memory tab content so close/switch keeps applied edits.
   */
  private syncUnsavedStateAfterReload(editorXml: string): void {
    const merge = window.__desktopMergeEditorBodyWithStoredHeader;
    const contentForStorage = typeof merge === 'function' ? merge(editorXml) : editorXml;

    const filePath =
      this.writer.overmindState?.editor?.resource?.filePath ??
      this.writer.overmindState?.document?.url;

    if (filePath) {
      this.writer.overmindActions?.project?.updateTabContent?.({
        filePath,
        content: contentForStorage,
      });
    } else if (window.electronAPI) {
      window.__desktopStoredDocumentXml = contentForStorage;
    }

    this.writer.overmindActions?.project?.markTabDirty?.(true);
    this.writer.overmindActions?.editor?.setContentHasChanged?.(true);
    if (this.writer.editor) this.writer.editor.isNotDirty = false;
  }

  private async persistDocument(doc: Document): Promise<void> {
    const xml = new XMLSerializer().serializeToString(doc);
    const path = this.documentPaths.get(doc);
    const globals = window as unknown as {
      electronAPI?: { writeFile: (filePath: string, content: string) => Promise<void> };
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
    };
    const activePath = globals.writer?.overmindState?.editor?.resource?.filePath;

    if (!path || path === 'current' || (activePath && samePath(path, activePath))) {
      this.writer.loadDocumentXML(xml);
      this.syncUnsavedStateAfterReload(xml);
      // The editor's own tag/attribute definitions aren't necessarily settled
      // immediately after a reload (worse if a modal briefly stole DOM focus,
      // e.g. a confirmation dialog) — give it a couple of frames before asking
      // it to re-derive XML for validation, and don't let a validate failure
      // surface as an unhandled rejection since persistence already succeeded.
      await yieldToUi();
      try {
        await this.writer.validate?.();
      } catch {
        // best-effort — validation feedback only, not required for persistence
      }
      return;
    }

    if (globals.electronAPI?.writeFile) {
      await globals.electronAPI.writeFile(path, xml);
    }
  }

  private logResolution(
    instance: MentionInstance,
    action: DecisionRecord['action'],
    entityId?: string,
    rejectedCandidate?: string,
  ): void {
    this.decisions.addRecord({
      when: new Date().toISOString(),
      documentId: instance.documentId,
      surface: instance.surface,
      tag: instance.tag,
      action,
      source: 'disambiguation',
      entityId,
      rejectedCandidate,
      scope: 'occurrence',
      occurrence: instance.anchor.occurrence,
      nodeHash: instance.anchor.nodeHash,
    });
  }

  async resolveMention(
    instance: MentionInstance,
    candidate: DisambiguationCandidate,
    options: { createNew?: boolean; name?: string; kind?: EntityKind; description?: string } = {},
  ): Promise<string> {
    if (!this.store) throw new Error('No entity store available');
    const entitiesDoc = this.entitiesDoc ?? (await this.loadEntities());
    const kind = options.kind ?? TAG_TO_KIND[instance.tag];
    if (!kind) throw new Error(`Unsupported tag: ${instance.tag}`);

    const entityId = resolveEntityInDocument(
      entitiesDoc,
      {
        kind,
        name: options.name ?? instance.surface,
        authorityIds: candidate.authorityIds,
        description: options.description ?? candidate.description,
        startYear: candidate.startYear,
        endYear: candidate.endYear,
      },
      options.createNew ? undefined : candidate,
    );

    assignEntity({ element: instance.element, entityId, resp: LJB_AUTOTAG_RESP });
    await this.saveEntities();
    await this.persistDocument(instance.element.ownerDocument!);
    this.logResolution(instance, 'resolved', entityId);
    return entityId;
  }

  async resolveMentions(
    instances: MentionInstance[],
    candidate: DisambiguationCandidate,
  ): Promise<string> {
    if (instances.length === 0) throw new Error('No mentions to resolve');
    const first = instances[0]!;
    const entityId = await this.resolveMention(first, candidate);
    for (const instance of instances.slice(1)) {
      assignEntity({ element: instance.element, entityId, resp: LJB_AUTOTAG_RESP });
      await this.persistDocument(instance.element.ownerDocument!);
      this.logResolution(instance, 'resolved', entityId);
    }
    return entityId;
  }

  async markUnresolved(
    instance: MentionInstance,
    candidates: DisambiguationCandidate[],
  ): Promise<void> {
    markMentionUnresolved(instance.element);
    this.rememberPendingCandidates(instance.tag, instance.surface, candidates);
    await this.savePendingCache();
    await this.persistDocument(instance.element.ownerDocument!);
    this.logResolution(instance, 'unresolved');
  }

  /** Remove @key from a resolved mention so it can be disambiguated again. */
  async clearMentionResolution(instance: MentionInstance): Promise<void> {
    markMentionUnresolved(instance.element);
    await this.persistDocument(instance.element.ownerDocument!);
    this.logResolution(instance, 'unresolved');
  }

  async clearMentionResolutions(instances: MentionInstance[]): Promise<void> {
    if (instances.length === 0) return;
    for (const instance of instances) markMentionUnresolved(instance.element);
    const docs = new Set(instances.map((item) => item.element.ownerDocument!));
    for (const doc of docs) await this.persistDocument(doc);
    for (const instance of instances) this.logResolution(instance, 'unresolved');
  }

  /**
   * Apply accepted suggestions to a fresh copy of the XML source and reload
   * the editor. Returns the apply engine's per-suggestion outcomes.
   */
  async apply(
    accepted: Suggestion[],
    userRules: UserRule[] = [],
    onProgress?: ApplyProgressCallback,
  ): Promise<BatchResult> {
    const total = accepted.length;
    onProgress?.(0, total);
    await yieldToUi();

    const doc = await this.getDocument();
    const schemaManager = this.writer.schemaManager;
    const applyOptions = {
      policy: this.policy,
      ...(schemaManager
        ? {
            canContain: (parent: string, child: string) =>
              canContainForAutoTagging(schemaManager, parent, child),
          }
        : {}),
      userRules,
      onProgress,
    };
    const raw = await applySuggestions(doc, accepted, applyOptions);
    const result = withApplyDiagnostics(doc, raw, applyOptions);

    if (result.applied > 0) {
      onProgress?.(total, total);
      await yieldToUi();
      this.snapshots.push(result.snapshot);
      const xml = new XMLSerializer().serializeToString(doc);
      this.writer.loadDocumentXML(xml);
      this.syncUnsavedStateAfterReload(xml);
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
    this.syncUnsavedStateAfterReload(snapshot);
    return true;
  }

  /**
   * Jump the editor to a suggestion. The editor holds a converted HTML
   * representation, so structural anchor fields don't apply; we locate the
   * surface by document-wide occurrence index in the editor body's text
   * stream (which matches the XML's, since conversion preserves text).
   * Best-effort: returns false when the editor is absent or the text differs.
   */
  focusMention(instance: MentionInstance): boolean {
    return this.focusAnchor(instance.anchor.surface, instance.anchor.occurrence);
  }

  focus(suggestion: Suggestion): boolean {
    const editor = this.writer.editor;
    if (!editor) return false;

    try {
      const displaySurface = dateCuratorDisplaySurface(suggestion);
      if (this.focusAnchor(displaySurface, suggestion.anchor.occurrence)) return true;
      return this.focusAnchor(suggestion.anchor.surface, suggestion.anchor.occurrence);
    } catch {
      return false;
    }
  }

  private focusAnchor(surface: string, occurrence: number): boolean {
    const editor = this.writer.editor;
    if (!editor) return false;

    try {
      const body = editor.getBody();
      const index = buildDocIndex(body, this.policy);
      const displaySurface = surface;

      // Prefer full date string (may span element boundaries in XML; flat in editor text).
      const flatStart = index.text.indexOf(displaySurface);
      if (flatStart !== -1 && displaySurface.length > 0) {
        for (let i = 0; i < index.nodes.length; i++) {
          const nodeStart = index.nodeStart[i]!;
          const nodeEnd = nodeStart + index.nodes[i]!.search.text.length;
          if (flatStart >= nodeStart && flatStart < nodeEnd) {
            const local = flatStart - nodeStart;
            const { node, search } = index.nodes[i]!;
            const endFlat = Math.min(flatStart + displaySurface.length, nodeEnd);
            const rawStart = search.map[local]!;
            const rawEnd = search.map[endFlat - nodeStart - 1]! + 1;
            const range = editor.getDoc().createRange();
            range.setStart(node, rawStart);
            range.setEnd(node, rawEnd);
            editor.selection.setRng(range);
            editor.selection.scrollIntoView?.();
            (node.parentElement as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
            return true;
          }
        }
      }

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
