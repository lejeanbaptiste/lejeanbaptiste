import { cachedPackReader } from '../services/authority-pack-lookup';
import type { AuthorityCache } from './authorityCache';
import {
  buildDisambiguationCandidates,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import type { DisambiguationAiCache } from './disambiguationAiCache';
import {
  placeProximityKmFromSettings,
  readPersistedDisambiguationSettings,
} from './disambiguationSettings';
import type { DilaPlaceDetailCache } from './dilaPlaceDetailCache';
import type { LlmClient } from './llmClient';
import { rankDisambiguationCandidates } from './llmDisambiguationRank';
import type { AiPromptProfile } from './aiPromptProfiles';
import type { MentionGroup } from './mentions';

/** The slice of AutoTaggingSession this warm pass needs — kept structural, like AuthorityPrefetchSession. */
export interface DisambiguationAiWarmPassSession {
  readonly cache: AuthorityCache | null;
  readonly dilaPlaceDetailCache: DilaPlaceDetailCache | null;
  readonly disambiguationAiCache: DisambiguationAiCache | null;
  getDocument(): Promise<Document>;
  getPendingCandidates(tag: string, surface: string): DisambiguationCandidate[] | null;
  disambiguationDbSources(
    tag: string,
    surface: string,
  ): Promise<{
    local: DisambiguationCandidate[];
    central?: {
      userStableId: string;
      candidates: DisambiguationCandidate[];
    };
    entitiesDoc: Document | null;
  }>;
}

export interface DisambiguationAiWarmPassOptions {
  client: LlmClient;
  promptProfile?: AiPromptProfile | null;
  preferredLanguage?: string | null;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Pre-warms the AI ranking cache (`session.disambiguationAiCache`) for every
 * not-yet-resolved mention group, one at a time, so navigating the panel
 * mention-to-mention feels instant once this finishes. Used when "Stream AI
 * results" is off — the panel still opens immediately; this just runs
 * alongside it in the background. Never touches React state — it's a pure
 * side-effecting warm pass, safe to call outside a component.
 */
export async function runDisambiguationAiWarmPass(
  session: DisambiguationAiWarmPassSession,
  groups: MentionGroup[],
  options: DisambiguationAiWarmPassOptions,
): Promise<void> {
  const { client, promptProfile, preferredLanguage, onProgress, signal } = options;
  const cache = session.disambiguationAiCache;
  if (!cache) return;
  const authorityCache = session.cache;
  if (!authorityCache) return;

  const queue = groups.filter((group) => !group.fullyResolved && group.instances.length > 0);
  if (queue.length === 0) return;

  const cacheDisabled = readPersistedDisambiguationSettings()?.disableCaching === true;
  const placeProximityKm = placeProximityKmFromSettings(readPersistedDisambiguationSettings());
  const doc = await session.getDocument();

  for (let i = 0; i < queue.length; i++) {
    if (signal?.aborted) return;
    onProgress?.(i, queue.length);
    const group = queue[i]!;
    try {
      let rows = session.getPendingCandidates(group.tag, group.surface);
      if (rows == null) {
        const dbSources = await session.disambiguationDbSources(group.tag, group.surface);
        if (signal?.aborted) return;
        rows = await buildDisambiguationCandidates(
          dbSources.entitiesDoc,
          group.tag,
          group.surface,
          authorityCache,
          ['Wikidata', 'VIAF'],
          false,
          cachedPackReader(),
          session.dilaPlaceDetailCache ?? undefined,
          undefined,
          undefined,
          undefined,
          dbSources.central,
          placeProximityKm,
          dbSources.local,
        );
      }
      if (signal?.aborted) return;
      await rankDisambiguationCandidates({
        doc,
        instance: group.instances[0]!,
        candidates: rows,
        client,
        cache: cacheDisabled ? null : cache,
        promptProfile,
        preferredLanguage,
      });
    } catch {
      // Best-effort — a failed warm pass just leaves that group to rank live when opened.
    }
    // Yield to the event loop between groups so the panel stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  onProgress?.(queue.length, queue.length);
}
