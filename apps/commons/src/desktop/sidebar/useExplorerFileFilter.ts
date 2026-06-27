import type { NamedPath } from '@src/types/desktop';
import { useEffect, useState } from 'react';

export const useExplorerFileFilter = (rootPath: string | null, isProjectReady: boolean) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [matches, setMatches] = useState<NamedPath[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filterQuery.trim()), 200);
    return () => clearTimeout(timer);
  }, [filterQuery]);

  useEffect(() => {
    if (!isProjectReady || !rootPath || !debouncedQuery || !window.electronAPI?.findXmlFilesByName) {
      setMatches([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    void window.electronAPI
      .findXmlFilesByName(rootPath, debouncedQuery)
      .then((results) => {
        if (!cancelled) {
          setMatches(results);
          setSearching(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
          setSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isProjectReady, rootPath]);

  return {
    filterQuery,
    isFiltering: debouncedQuery.length > 0,
    matches,
    searching,
    setFilterQuery,
  };
};
