import { useEffect, useState } from 'react';
import { enrichDateAuthorityIndex } from './search';
import { isCjkDatesEnabled } from '../plugins';
import { cjkDatesListDateAuthority, isCjkDatesPythonAvailable } from '../plugins/cjkDatesPython';
import type { DateAuthorityIndex } from './types';

let cachedIndex: DateAuthorityIndex | null = null;
let cacheKey = '';
let inflight: Promise<DateAuthorityIndex | null> | null = null;
let inflightKey = '';

const defaultCiv = ['c', 'j', 'k'] as const;

export async function loadDateAuthority(
  civ: readonly string[] = defaultCiv,
): Promise<DateAuthorityIndex | null> {
  const key = civ.join(',');
  if (cachedIndex && cacheKey === key) return cachedIndex;

  if (!isCjkDatesPythonAvailable() || !isCjkDatesEnabled()) return null;

  if (!inflight || inflightKey !== key) {
    inflightKey = key;
    inflight = cjkDatesListDateAuthority({ civ: [...civ] })
      .then((raw) => {
        const index = enrichDateAuthorityIndex(raw);
        cachedIndex = index;
        cacheKey = key;
        return index;
      })
      .finally(() => {
        if (inflightKey === key) {
          inflight = null;
          inflightKey = '';
        }
      });
  }

  return inflight;
}

export function useDateAuthority(
  enabled: boolean,
  civ: readonly string[] = defaultCiv,
): {
  authority: DateAuthorityIndex | null;
  loading: boolean;
  error: string | null;
} {
  const civKey = civ.join(',');
  const [authority, setAuthority] = useState<DateAuthorityIndex | null>(
    enabled && cachedIndex && cacheKey === civKey ? cachedIndex : null,
  );
  const [loading, setLoading] = useState(enabled && (!cachedIndex || cacheKey !== civKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(!cachedIndex || cacheKey !== civKey);
    setError(null);

    void loadDateAuthority(civ)
      .then((index) => {
        if (cancelled) return;
        if (!index) {
          // Leave error null so the UI can show the translated
          // LW.dateAuthority.calendar_lookup_unavailable message.
          setError(null);
          setAuthority(null);
          return;
        }
        setAuthority(index);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setAuthority(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Keyed to `civKey`, the stable string derived from `civ`; depending on the
    // value itself would refetch whenever its identity changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, civKey]);

  return { authority, loading, error };
}

export function isDateAuthorityAvailable(): boolean {
  return isCjkDatesPythonAvailable() && isCjkDatesEnabled();
}

/** Sync peek at the in-memory authority cache (null until first successful load). */
export function peekDateAuthorityCache(): DateAuthorityIndex | null {
  return cachedIndex;
}
