import { AutoTaggingSession } from './integration';
import {
  runAuthorityPrefetch,
  type AuthorityPrefetchHandle,
} from './authorityPrefetch';

/**
 * Unattended authority prefetch that runs right after auto-tagging applies
 * tags, so the disambiguation panel opens onto warm caches instead of firing
 * every lookup on demand. Paced far more gently than the panel's own prefetch
 * (one group every couple of seconds, and only on idle ticks) so the editor
 * stays fully responsive while it works. Progress is surfaced through the
 * bottom-bar authority-load indicator like any other prefetch.
 *
 * Module-level singleton: starting a new sweep (or the panel opening with its
 * own prefetch) supersedes the previous one.
 */

const BACKGROUND_PACE_MS = 2000;

let handle: AuthorityPrefetchHandle | null = null;
let generation = 0;

export function stopBackgroundAuthorityPrefetch(): void {
  generation += 1;
  handle?.stop();
  handle = null;
}

export function startBackgroundAuthorityPrefetch(
  writer: ConstructorParameters<typeof AutoTaggingSession>[0],
): void {
  stopBackgroundAuthorityPrefetch();
  const startedGeneration = generation;
  void (async () => {
    try {
      const session = new AutoTaggingSession(writer);
      if (!session.entityStore) return;
      await session.loadEntities();
      if (startedGeneration !== generation) return;
      const groups = await session.scanMentions();
      if (startedGeneration !== generation) return;
      handle = runAuthorityPrefetch(session, groups, { paceMs: BACKGROUND_PACE_MS });
    } catch {
      // Best-effort — the panel's own prefetch covers anything missed here.
    }
  })();
}
