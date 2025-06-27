import { useAtom, useAtomValue } from 'jotai';
import type { AuthorityLookupResult, EntityLink, NamedEntityType } from '../../types/index';
import {
  authoritiesAtom,
  entityTypeAtom,
  isUriValidAtom,
  isUserAuthenticatedAtom,
  LookupService,
  manualInputAtom,
  queryAtom,
  selectedAtom,
} from './store';

export const useEntityLookup = () => {
  const [authorities, setAuthorities] = useAtom(authoritiesAtom);
  const entityType = useAtomValue(entityTypeAtom);
  const isUriValid = useAtomValue(isUriValidAtom);
  const isUserAuthenticated = useAtomValue(isUserAuthenticatedAtom);
  const manualInput = useAtomValue(manualInputAtom);
  const query = useAtomValue(queryAtom);
  const [selected, setSelected] = useAtom(selectedAtom);

  const processSelected = () => {
    if (selected) {
      const link: EntityLink = {
        id: selected.uri,
        name: selected.label,
        properties: { lemma: selected.label, uri: selected.uri },
        query,
        repository: selected.authority,
        type: entityType,
        uri: selected.uri,
      };
      return link;
    }

    if (manualInput !== '' && isUriValid) {
      const link: EntityLink = {
        id: manualInput,
        name: query,
        properties: { lemma: query, uri: manualInput },
        query,
        repository: 'custom',
        type: entityType,
        uri: manualInput,
      };
      return link;
    }
  };

  const onSearchResult = (authority: LookupService, result: AuthorityLookupResult[]) => {
    authority = { ...authority, results: { status: 'success', candidates: result } };
    setAuthorities((prev) => {
      const authorityIndex = prev.findIndex((item) => item.id === authority.id);
      prev = prev.with(authorityIndex, authority);
      return prev;
    });
  };

  const onSearchError = (authority: LookupService, error: Error) => {
    authority = { ...authority, results: { status: 'error', message: error.message } };
    setAuthorities((prev) => {
      const authorityIndex = prev.findIndex((item) => item.id === authority.id);
      prev = prev.with(authorityIndex, authority);
      return prev;
    });
  };

  const search = async ({ query, type }: { query: string; type: NamedEntityType }) => {
    setSelected(null);

    //reset authorities results
    const resetedAuthorities = authorities.map((authority) => {
      authority = { ...authority, results: { status: 'loading' } };
      return authority;
    });
    setAuthorities(resetedAuthorities);

    for (const authority of authorities) {
      authority
        .search({
          query,
          entityType: type,
          options: { authorityId: authority.id, isUserAuthenticated },
        })
        .then((results) => onSearchResult(authority, results))
        .catch((error) => onSearchError(authority, error));
    }
  };

  return {
    processSelected,
    search,
  };
};
