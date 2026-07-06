import { useEffect, useState } from 'react';
import { enrichDateAuthorityIndex } from './search';
import type { DateAuthorityIndex } from './types';

let cachedIndex: DateAuthorityIndex | null = null;
let cacheKey = '';
let inflight: Promise<DateAuthorityIndex | null> | null = null;

const defaultCiv = ['c', 'j', 'k'] as const;

export async function loadDateAuthority(
  civ: readonly string[] = defaultCiv,
): Promise<DateAuthorityIndex | null> {
  const key = civ.join(',');
  if (cachedIndex && cacheKey === key) return cachedIndex;

  const listFn = window.electronAPI?.sanmiaoListDateAuthority;
  if (!listFn) return null;

  if (!inflight) {
    inflight = listFn({ civ: [...civ] })
      .then((raw) => {
        const index = enrichDateAuthorityIndex(raw);
        cachedIndex = index;
        cacheKey = key;
        return index;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function useDateAuthority(enabled: boolean): {
  authority: DateAuthorityIndex | null;
  loading: boolean;
  error: string | null;
} {
  const [authority, setAuthority] = useState<DateAuthorityIndex | null>(
    enabled && cachedIndex ? cachedIndex : null,
  );
  const [loading, setLoading] = useState(enabled && !cachedIndex);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(!cachedIndex);
    setError(null);

    void loadDateAuthority()
      .then((index) => {
        if (cancelled) return;
        if (!index) {
          setError('Sanmiao lookup tables are not available.');
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
  }, [enabled]);

  return { authority, loading, error };
}

export function isDateAuthorityAvailable(): boolean {
  return Boolean(window.electronAPI?.sanmiaoListDateAuthority);
}
