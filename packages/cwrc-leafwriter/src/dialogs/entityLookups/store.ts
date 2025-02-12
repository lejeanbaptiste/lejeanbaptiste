import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import type {
  AuthorityLookupResult,
  AuthorityService,
  EntityLink,
  EntityType,
  EntryLink,
  NamedEntityType,
} from '../../types';
import { urlRegex } from '../../utilities';

export type LookupService = AuthorityService & {
  results?:
    | { status: 'success'; candidates: AuthorityLookupResult[] }
    | { status: 'error'; message: string }
    | { status: 'loading' };
};

export const authoritiesAtom = atom<LookupService[]>([]);
authoritiesAtom.debugLabel = 'authorities.Atom';

export const entityTypeAtom = atom<EntityType>('thing');
entityTypeAtom.debugLabel = 'entityType.Atom';

export const lookupTypeAtom = atom((get) => {
  const entityType = get(entityTypeAtom);
  return entityType === 'citation' ? 'work' : (entityType as NamedEntityType);
});
lookupTypeAtom.debugLabel = 'typeLookup.Atom';

export const queryAtom = atom('');
queryAtom.debugLabel = 'query.Atom';

export const lookupsBeenFetchedAtom = atom((get) => {
  const authorities = get(authoritiesAtom);
  const beenFetched = authorities.filter((a) => a.results?.status === 'loading').length;
  return beenFetched;
});
lookupsBeenFetchedAtom.debugLabel = 'lookupsBeenFetched.Atom';

export const isUserAuthenticatedAtom = atom(false);
isUserAuthenticatedAtom.debugLabel = 'isUserAuthenticated.Atom';

export const selectedAtom = atomWithReset<EntryLink | null>(null);
selectedAtom.debugLabel = 'selected.Atom';

export const manualInputAtom = atom<string>('');
manualInputAtom.debugLabel = 'manualInput.Atom';

export const isUriValidAtom = atom((get) => {
  const input = get(manualInputAtom);
  if (!input) return true;
  return urlRegex.test(input);
});
isUriValidAtom.debugLabel = 'isUriValid.Atom';

export const onCloseAtom = atom<
  ((response?: EntityLink | Pick<EntityLink, 'query' | 'type'>) => void) | undefined
>(undefined);
onCloseAtom.debugLabel = 'onClose.Atom';

export const resetLookupAtom = atom(null, (_get, set) => {
  set(authoritiesAtom, []);
  set(manualInputAtom, '');
  set(queryAtom, '');
  set(selectedAtom, null);
});
