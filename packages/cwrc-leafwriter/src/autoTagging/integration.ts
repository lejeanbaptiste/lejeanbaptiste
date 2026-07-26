import { buildDocIndex, locateOccurrenceInIndex } from './anchor';
import { autoSyncEntityToCentral } from './autoSync';
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
import {
  collectGivenFamilyNamesForCandidate,
  collectTypedNamesForCandidate,
  resolveCandidateForPedb,
  resolveEntityInDocument,
} from './disambiguationCandidates';
import {
  parsePendingCache,
  serializePendingCache,
  setPendingCandidates,
  type PendingCache,
} from './disambiguationPending';
import { DecisionLogBuffer, type DecisionRecord } from './decisionLog';
import { TAG_TO_KIND, type EntityKind } from './entities';
import { autoRomanize } from '../utilities/romanize';
import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
  type DesktopEntityStoreGlobals,
  type EntityStore,
} from './entityStore';
import { readOrMintUserStableId } from './userStableId';
import { candidatesFromEntityDatabase } from './ownDatabaseCandidates';
import {
  nameTypeTaggingPolicyFromSettings,
  readPersistedAuthoritySettings,
} from './authoritySettings';
import { crawlDocuments } from './crawl';
import { dictionaryTag, type DictionaryEntry } from './dictionary';
import { DisambiguationAiCache } from './disambiguationAiCache';
import type { AiPromptProfile } from './aiPromptProfiles';
import type { LlmClient } from './llmClient';
import { LlmCache } from './llmCache';
import { llmSuggest, type LlmSuggestResult } from './llmSuggest';
import { listEntities } from './entityOps';
import { collectTaggedSpans, prepareSuggestionsForReview } from './suggestionFilters';
import { keyedPersNameFloors, phase2StringsForEntity, shortFormTag } from './shortFormTag';
import { llmAudit, type LlmAuditResult } from './llmAudit';
import { normalizeDomText } from './normalize';
import { AUTHORITY_PACKS, authorityPackOrigin, type AuthorityPackId } from './packPaths';
import { tagFollowingStyleNames } from './styleNameTag';
import { MAX_AUTHORITY_SUGGESTIONS, runAuthorityTagBombOnDocument } from './authorityTagBomb';
import type { DateTagOptions, SanmiaoBatchResolveFn, SanmiaoBatchTagFn } from './sanmiaoDateTypes';
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
import { resolveCurrentDocumentXml } from './documentContent';
import { findSelectionRangeInDocument, searchTextForDomRange } from './selectionScope';
import type { TagBombScope } from './tagBombScope';

export { MAX_AUTHORITY_SUGGESTIONS } from './authorityTagBomb';

/** Entity kind read from PEDB/CEDB entities.xml for each own-database pack id. */
export const OWN_DATABASE_KIND_BY_PACK_ID: Partial<Record<AuthorityPackId, EntityKind>> = {
  'pedb-persons': 'person',
  'pedb-places': 'place',
  'pedb-orgs': 'org',
  'pedb-works': 'work',
  'cedb-persons': 'person',
  'cedb-places': 'place',
  'cedb-orgs': 'org',
  'cedb-works': 'work',
};

/**
 * Broader TEI tag synonyms crawled per category (mirrors `DEFAULT_CRAWL_TAGS`
 * in `crawl.ts`), keyed by a project/list pack's `defaultTag`.
 */
const CRAWL_TAGS_BY_DEFAULT_TAG: Record<string, string[]> = {
  persName: ['persName'],
  placeName: ['placeName', 'geogName'],
  orgName: ['orgName', 'org'],
  roleName: ['roleName'],
  title: ['title', 'name'],
};

export interface TagBombImportedList {
  name: string;
  entries: DictionaryEntry[];
}

export interface TagBombOptions {
  dateFilter?: DateRangeFilter;
  onProgress?: (message: string) => void;
  /** Parsed CSV/TSV/xlsx/ODS files chosen in the panel, filtered by the checked `list-*` categories. */
  importedLists?: TagBombImportedList[];
  /** Which document(s) to scan. Defaults to `currentFile` — the pre-scope behavior. */
  scope?: TagBombScope;
  /** Folder path, required when `scope` is `custom`. */
  customPath?: string;
}

export interface TagBombResult {
  /** Suggestions for the current/first-matched document — unchanged for `currentFile` scope. */
  suggestions: Suggestion[];
  candidateCount: number;
  matchCount: number;
  loaded: Partial<Record<AuthorityPackId, number>>;
  truncated: boolean;
  /**
   * Present when `scope` matched more than one document. One entry per
   * document that had at least one suggestion, for sequential per-document
   * review. `suggestions` above mirrors `byDocument[0]` in that case.
   */
  byDocument?: TagBombDocumentResult[];
}

export interface TagBombDocumentResult {
  filePath: string;
  suggestions: Suggestion[];
  matchCount: number;
}

export interface TagBombScopeDocument {
  doc: Document;
  filePath: string;
}

/**
 * The slice of Writer this session needs. Kept structural so the session can
 * be tested without a live editor.
 */
export interface WriterLike {
  converter: { getDocumentContent: (includeRDF: boolean) => Promise<string | null | undefined> };
  getContent?: () => Promise<string | null | undefined>;
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
    document?: { url?: string; xml?: string };
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
  private projectLangPromise: Promise<string | null> | null = null;

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

  private centralContextPromise: Promise<{ store: EntityStore; userStableId: string } | null> | null = null;

  /**
   * Resolve the central database + this user's stable id, when this project
   * has syncToCentral on - so disambiguation can also search the CEDB.
   * Memoized per session: this is called once per candidate lookup and the
   * result never changes mid-session.
   */
  async centralContext(): Promise<{ store: EntityStore; userStableId: string } | null> {
    if (!this.centralContextPromise) {
      this.centralContextPromise = (async () => {
        const project = (window as unknown as DesktopEntityStoreGlobals).__ljbLspProject;
        if (!project?.syncToCentral) return null;
        const api = desktopEntityFileApi();
        if (!api) return null;
        const centralFolder = project.entityDbFolder ?? null;
        const centralStore = centralEntityStoreFromDesktop(centralFolder);
        if (!centralStore) return null;
        const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
        return { store: centralStore, userStableId };
      })();
    }
    return this.centralContextPromise;
  }

  /** The `central` argument buildDisambiguationCandidates expects, or null when syncToCentral is off. */
  async candidateSearchCentralContext(): Promise<{ doc: Document; userStableId: string } | null> {
    const central = await this.centralContext();
    if (!central) return null;
    const doc = await central.store.loadEntities();
    return { doc, userStableId: central.userStableId };
  }

  /** Project source language (BCP-47) from the desktop bridge; cached for the session. */
  projectLanguage(): Promise<string | null> {
    this.projectLangPromise ??= (async () => {
      try {
        const globals = window as unknown as {
          __leafWriterProject?: { getProjectSourceLanguage?: () => Promise<string | null> };
        };
        return (await globals.__leafWriterProject?.getProjectSourceLanguage?.()) ?? null;
      } catch {
        return null;
      }
    })();
    return this.projectLangPromise;
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
    const { suggestions, droppedNested } = prepareSuggestionsForReview(
      doc,
      this.policy,
      result.suggestions,
    );
    return {
      suggestions,
      unverifiableCount: result.unverifiableCount + droppedNested,
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
    const { suggestions, droppedNested } = prepareSuggestionsForReview(
      doc,
      this.policy,
      result.suggestions,
    );
    return {
      ...result,
      suggestions,
      unverifiableCount: result.unverifiableCount + droppedNested,
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
    const { suggestions } = prepareSuggestionsForReview(doc, this.policy, result.suggestions);
    return { ...result, suggestions };
  }

  /**
   * Unified "Tag bomb": pools NDJSON authority packs, PEDB/CEDB (read live
   * from entities.xml), this project's already-tagged mentions (disambiguated
   * and not), and any imported CSV/TSV/xlsx/ODS lists into one run. The date
   * filter applies only to sources with real dates (packs, PEDB, CEDB) — project
   * tags and imported-list entries have none and pass through unfiltered.
   */
  async runTagBomb(
    packIds: AuthorityPackId[],
    readPackFile: (packId: AuthorityPackId) => Promise<string>,
    options: TagBombOptions = {},
  ): Promise<TagBombResult> {
    const scope = options.scope ?? 'currentFile';
    const { documents: scopeDocs, error } = await this.resolveTagBombScopeDocuments(
      scope,
      options.customPath,
    );
    if (error) throw new Error(error);
    if (scopeDocs.length === 0) throw new Error('No documents matched the selected scope.');

    const sourceLang = await this.projectLanguage();
    const authoritySettings = readPersistedAuthoritySettings();
    const nameTypePolicy = nameTypeTaggingPolicyFromSettings(authoritySettings, sourceLang);

    const pedbIds = packIds.filter((id) => this.specOrigin(id) === 'pedb');
    const cedbIds = packIds.filter((id) => this.specOrigin(id) === 'cedb');
    const projectIds = packIds.filter((id) => this.specOrigin(id) === 'project');
    const listIds = packIds.filter((id) => this.specOrigin(id) === 'list');

    const extraCandidates: { groupLabel: string; candidates: ReturnType<typeof candidatesFromEntityDatabase> }[] = [];
    if (pedbIds.length > 0 && this.store) {
      const pedbDoc = await this.store.loadEntities();
      for (const id of pedbIds) {
        const kind = OWN_DATABASE_KIND_BY_PACK_ID[id];
        if (!kind) continue;
        extraCandidates.push({
          groupLabel: id,
          candidates: candidatesFromEntityDatabase(pedbDoc, kind, 'PEDB', nameTypePolicy),
        });
      }
    }
    if (cedbIds.length > 0) {
      const centralStore = centralEntityStoreFromDesktop(null);
      if (centralStore) {
        const cedbDoc = await centralStore.loadEntities();
        for (const id of cedbIds) {
          const kind = OWN_DATABASE_KIND_BY_PACK_ID[id];
          if (!kind) continue;
          extraCandidates.push({
            groupLabel: id,
            candidates: candidatesFromEntityDatabase(cedbDoc, kind, 'CEDB', nameTypePolicy),
          });
        }
      }
    }

    // Project-tag dictionary is pooled across the whole project regardless of
    // scope — computed once and reused for every scanned document.
    let pooledProjectEntries: DictionaryEntry[] = [];
    if (projectIds.length > 0) {
      const crawlTags = [...new Set(projectIds.flatMap((id) => this.crawlTagsFor(id)))];
      if (crawlTags.length > 0) {
        const { documents } = await this.getProjectDocuments();
        pooledProjectEntries = crawlDocuments(documents, this.policy, crawlTags);
      }
    }

    const multiDoc = scopeDocs.length > 1;
    const byDocument: TagBombDocumentResult[] = [];
    let lastCandidateCount = 0;
    let totalMatchCount = 0;
    let lastLoaded: Partial<Record<AuthorityPackId, number>> = {};
    let anyTruncated = false;

    for (const { doc, filePath } of scopeDocs) {
      const authorityResult = await runAuthorityTagBombOnDocument(doc, packIds, readPackFile, this.policy, {
        dateFilter: options.dateFilter,
        extraCandidates,
        nameTypePolicy,
        onProgress: (message) => {
          options.onProgress?.(multiDoc ? `${filePath}: ${message}` : message);
          void yieldToUi();
        },
      });

      const extraSuggestionGroups: Suggestion[][] = [];
      const loaded: Partial<Record<AuthorityPackId, number>> = { ...authorityResult.loaded };

      if (pooledProjectEntries.length > 0) {
        loaded['project' as AuthorityPackId] =
          (loaded['project' as AuthorityPackId] ?? 0) + pooledProjectEntries.length;
        extraSuggestionGroups.push(dictionaryTag(doc, pooledProjectEntries, this.policy, 'this project'));
      }

      if (listIds.length > 0 && (options.importedLists?.length ?? 0) > 0) {
        const listTags = new Set(listIds.map((id) => this.defaultTagFor(id)).filter((tag): tag is string => !!tag));
        for (const file of options.importedLists ?? []) {
          const filtered = file.entries.filter((entry) => listTags.has(entry.tag));
          if (filtered.length === 0) continue;
          loaded['list' as AuthorityPackId] = (loaded['list' as AuthorityPackId] ?? 0) + filtered.length;
          extraSuggestionGroups.push(dictionaryTag(doc, filtered, this.policy, file.name));
        }
      }

      const merged = [authorityResult.suggestions, ...extraSuggestionGroups].flat();
      const { suggestions: deduped } = prepareSuggestionsForReview(doc, this.policy, merged);
      const truncated = authorityResult.truncated || deduped.length > MAX_AUTHORITY_SUGGESTIONS;
      const suggestions = deduped.slice(0, MAX_AUTHORITY_SUGGESTIONS);

      lastCandidateCount = authorityResult.candidateCount;
      lastLoaded = loaded;
      totalMatchCount += authorityResult.matchCount;
      anyTruncated = anyTruncated || truncated;

      if (!multiDoc || suggestions.length > 0) {
        byDocument.push({ filePath, suggestions, matchCount: authorityResult.matchCount });
      }
    }

    return {
      suggestions: byDocument[0]?.suggestions ?? [],
      candidateCount: lastCandidateCount,
      matchCount: totalMatchCount,
      loaded: lastLoaded,
      truncated: anyTruncated,
      ...(multiDoc ? { byDocument } : {}),
    };
  }

  /**
   * Phase-2 short-form pass: seed from keyed people in the active document,
   * match their phase-2 typed names (min length 1), always send hits to review.
   */
  async runShortFormTag(options?: { startFromFirstAppearance?: boolean }): Promise<{
    suggestions: Suggestion[];
    keyedEntityCount: number;
    stringCount: number;
    notice?: string;
  }> {
    if (!this.store) {
      throw new Error('Entity database is not configured.');
    }

    const doc = await this.getDocument();
    const floors = keyedPersNameFloors(doc, this.policy);
    const keyedEntityCount = floors.size;

    if (keyedEntityCount === 0) {
      return {
        suggestions: [],
        keyedEntityCount: 0,
        stringCount: 0,
        notice:
          'No keyed person names in this document. Tag and link people first (tag bomb or manual), then run short-form tagging.',
      };
    }

    const entitiesDoc = await this.store.loadEntities();
    const entitiesById = new Map(
      listEntities(entitiesDoc)
        .filter((entity) => entity.kind === 'person' && floors.has(entity.id))
        .map((entity) => [entity.id, entity] as const),
    );

    const sourceLang = await this.projectLanguage();
    const nameTypePolicy = nameTypeTaggingPolicyFromSettings(
      readPersistedAuthoritySettings(),
      sourceLang,
    );

    let stringCount = 0;
    for (const entityId of floors.keys()) {
      const entity = entitiesById.get(entityId);
      if (entity) stringCount += phase2StringsForEntity(entity, nameTypePolicy).length;
    }

    if (stringCount === 0) {
      return {
        suggestions: [],
        keyedEntityCount,
        stringCount: 0,
        notice:
          'The keyed people in this document have no phase-2 name strings in your entity database (courtesy / given names, short 號, etc.). Add typed names on those entities or run authority backfill when available.',
      };
    }

    const suggestions = shortFormTag(doc, entitiesById, floors, {
      policy: nameTypePolicy,
      whitespacePolicy: this.policy,
      startFromFirstAppearance: options?.startFromFirstAppearance,
    });

    if (suggestions.length === 0) {
      return {
        suggestions: [],
        keyedEntityCount,
        stringCount,
        notice:
          'No untagged short-form matches in this document (or every match falls before the first keyed appearance when that option is on).',
      };
    }

    return { suggestions, keyedEntityCount, stringCount };
  }

  private specOrigin(id: AuthorityPackId): ReturnType<typeof authorityPackOrigin> | undefined {
    const spec = AUTHORITY_PACKS.find((p) => p.id === id);
    return spec ? authorityPackOrigin(spec) : undefined;
  }

  /** Broader TEI tag synonyms to crawl for a `project-*` pack id's category. */
  private crawlTagsFor(id: AuthorityPackId): string[] {
    const tag = this.defaultTagFor(id);
    return tag ? (CRAWL_TAGS_BY_DEFAULT_TAG[tag] ?? [tag]) : [];
  }

  private defaultTagFor(id: AuthorityPackId): string | undefined {
    return AUTHORITY_PACKS.find((p) => p.id === id)?.defaultTag;
  }

  async runEastAsianDateTag(
    batchTag: SanmiaoBatchTagFn,
    options: DateTagOptions = {},
  ): Promise<{ suggestions: Suggestion[]; proposalCount: number }> {
    const { dateTagOnlyFromSanmiao } = await import('./dates');
    const doc = await this.getDocument();
    const suggestions = await dateTagOnlyFromSanmiao(doc, this.policy, batchTag, options);
    return { suggestions, proposalCount: suggestions.length };
  }

  async runEastAsianDateResolve(
    batchResolve: SanmiaoBatchResolveFn,
    options: DateTagOptions = {},
  ): Promise<{ suggestions: Suggestion[]; proposalCount: number }> {
    const { dateResolveFromDocument } = await import('./dates');
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
    const xml = await resolveCurrentDocumentXml(this.writer);
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
    this.documentPaths.set(current, activePath ?? 'current');
    const documents = await this.readXmlFilesUnder(root, activePath ?? '', current);
    return { documents, available: true };
  }

  /** `current` plus every readable, parseable XML file under `root` (skipping `activePath`). */
  private async readXmlFilesUnder(
    root: string,
    activePath: string,
    current: Document,
  ): Promise<Document[]> {
    const globals = window as unknown as { electronAPI?: Partial<DesktopProjectApi> };
    const api = globals.electronAPI;
    const documents = [current];
    if (!api?.listProjectXmlFiles || !api.readFile) return documents;

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
    return documents;
  }

  /**
   * Resolve the document set for a tag bomb `scope`. `currentFile` is the
   * legacy single-document behavior; the others gather documents from open
   * tabs, the whole project, or an arbitrary folder (desktop only).
   */
  async resolveTagBombScopeDocuments(
    scope: TagBombScope,
    customPath?: string,
  ): Promise<{ documents: TagBombScopeDocument[]; error?: string }> {
    const current = await this.getDocument();
    const globals = window as unknown as {
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
      __ljbLspProject?: { projectRoot?: string };
      __leafWriterProject?: {
        getOpenTabs?: () => { filePath: string; content: string }[];
      };
    };
    const activePath = globals.writer?.overmindState?.editor?.resource?.filePath ?? 'current';
    this.documentPaths.set(current, activePath);

    if (scope === 'currentFile') {
      return { documents: [{ doc: current, filePath: activePath }] };
    }

    if (scope === 'openTabs') {
      const tabs = globals.__leafWriterProject?.getOpenTabs?.() ?? [];
      if (tabs.length === 0) return { documents: [], error: 'No files are open.' };

      const documents: TagBombScopeDocument[] = [];
      for (const tab of tabs) {
        if (samePath(tab.filePath, activePath)) {
          documents.push({ doc: current, filePath: activePath });
          continue;
        }
        try {
          const doc = new DOMParser().parseFromString(tab.content, 'application/xml');
          if (doc.getElementsByTagName('parsererror').length > 0) continue;
          normalizeDomText(doc);
          this.documentPaths.set(doc, tab.filePath);
          documents.push({ doc, filePath: tab.filePath });
        } catch {
          // skip files that can't be parsed
        }
      }
      return { documents };
    }

    if (scope === 'project') {
      const root = globals.__ljbLspProject?.projectRoot;
      if (!root) return { documents: [], error: 'Open a project folder first.' };
      const documents = await this.readXmlFilesUnder(root, activePath, current);
      return {
        documents: documents.map((doc) => ({
          doc,
          filePath: this.documentPaths.get(doc) ?? activePath,
        })),
      };
    }

    const folder = customPath?.trim();
    if (!folder) return { documents: [], error: 'Enter a folder path.' };
    const documents = await this.readXmlFilesUnder(folder, activePath, current);
    return {
      documents: documents.map((doc) => ({
        doc,
        filePath: this.documentPaths.get(doc) ?? activePath,
      })),
    };
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
    options: {
      createNew?: boolean;
      name?: string;
      kind?: EntityKind;
      description?: string;
      romanizedName?: string;
    } = {},
  ): Promise<string> {
    if (!this.store) throw new Error('No entity store available');
    const entitiesDoc = this.entitiesDoc ?? (await this.loadEntities());
    const kind = options.kind ?? TAG_TO_KIND[instance.tag];
    if (!kind) throw new Error(`Unsupported tag: ${instance.tag}`);

    // A candidate picked from the central database (syncToCentral merged
    // search) needs a project mirror minted/linked before it can be treated
    // as an ordinary local match.
    if (candidate.centralEntityId) {
      const central = await this.centralContext();
      if (central) {
        candidate = await resolveCandidateForPedb(candidate, entitiesDoc, central.store, central.userStableId);
      }
    }

    const projectLang = await this.projectLanguage();
    const name = options.name ?? instance.surface;
    const projectLangName = options.createNew ? undefined : candidate.projectLangName;
    const romanizedName =
      options.romanizedName ??
      candidate.romanizedName ??
      autoRomanize(projectLangName ?? name, projectLang) ??
      undefined;
    // Pull every typed name (courtesy 字, posthumous 諡號, birth name, …) plus
    // given/family name the chosen authority knows, so the entity record
    // carries them from day one — this runs even for createNew (e.g. a
    // manually-pasted Wikidata link with no reconcile candidate) since the
    // candidate still carries the authority id to look up.
    const [typedNames, givenFamilyNames] = await Promise.all([
      collectTypedNamesForCandidate(candidate),
      collectGivenFamilyNamesForCandidate(candidate, projectLang),
    ]);

    const entityId = resolveEntityInDocument(
      entitiesDoc,
      {
        kind,
        name,
        projectLangName,
        romanizedName,
        nameLang: projectLang ?? undefined,
        typedNames,
        familyName: givenFamilyNames.familyName,
        givenName: givenFamilyNames.givenName,
        authorityIds: candidate.authorityIds,
        description: options.description ?? candidate.description,
        startYear: candidate.startYear,
        endYear: candidate.endYear,
      },
      options.createNew ? undefined : candidate,
    );

    assignEntity({ element: instance.element, entityId });
    if (instance.tag === 'persName') {
      tagFollowingStyleNames(instance.element.ownerDocument!);
    }
    await autoSyncEntityToCentral(entitiesDoc, entityId);
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
      assignEntity({ element: instance.element, entityId });
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

  /**
   * Apply suggestions straight to `filePath`, bypassing the review panel
   * ("Skip review"). Reloads the live editor when it's the active document;
   * otherwise re-reads, patches, and writes the file directly, then asks the
   * app shell to refresh a matching open tab if one exists.
   */
  async applyTagBombDocument(
    filePath: string,
    suggestions: Suggestion[],
    userRules: UserRule[] = [],
  ): Promise<BatchResult> {
    const globals = window as unknown as {
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
      __leafWriterProject?: { reloadFileFromDisk?: (filePath: string) => Promise<void> };
      electronAPI?: {
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<void>;
      };
    };
    const activePath = globals.writer?.overmindState?.editor?.resource?.filePath;
    if (activePath && samePath(filePath, activePath)) {
      return this.apply(suggestions, userRules);
    }

    const api = globals.electronAPI;
    if (!api?.readFile || !api.writeFile) {
      throw new Error('File access is not available.');
    }
    const xml = await api.readFile(filePath);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    normalizeDomText(doc);
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
    };
    const raw = await applySuggestions(doc, suggestions, applyOptions);
    const result = withApplyDiagnostics(doc, raw, applyOptions);
    if (result.applied > 0) {
      const serialized = new XMLSerializer().serializeToString(doc);
      await api.writeFile(filePath, serialized);
      await globals.__leafWriterProject?.reloadFileFromDisk?.(filePath);
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
      const displaySurface =
        suggestion.source === 'dates' && suggestion.dateResolution
          ? suggestion.dateResolution.displaySurface ?? suggestion.anchor.surface
          : suggestion.anchor.surface;
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
      // Use the Nth document-wide occurrence — never indexOf's first hit.
      // Flat search text also covers date strings that span element boundaries.
      const located = locateOccurrenceInIndex(index, surface, occurrence);
      if (!located) return false;

      const range = editor.getDoc().createRange();
      range.setStart(located.node, located.start);
      range.setEnd(located.node, located.end);
      editor.selection.setRng(range);
      editor.selection.scrollIntoView?.();
      (located.node.parentElement as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
      return true;
    } catch {
      // focusing is a convenience; never let it break the review walk
    }
    return false;
  }
}
