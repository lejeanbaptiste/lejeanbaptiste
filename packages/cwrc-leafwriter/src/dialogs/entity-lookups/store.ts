import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import type {
  LookupConflictCandidate,
  LookupResolutionPlan,
  LookupSelectionInput,
} from '../../autoTagging/lookupResolve';
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

/** Checkbox-selected candidates (keyed by uri), for linking several authority entries to one entity. */
export const checkedEntriesAtom = atomWithReset<Map<string, EntryLink>>(new Map());
checkedEntriesAtom.debugLabel = 'checkedEntries.Atom';

export const manualInputAtom = atom<string>('');
manualInputAtom.debugLabel = 'manualInput.Atom';

export const isUriValidAtom = atom((get) => {
  const input = get(manualInputAtom);
  if (!input) return true;
  return urlRegex.test(input);
});
isUriValidAtom.debugLabel = 'isUriValid.Atom';

/** Pending resolve-on-select state: confirm/conflict steps before entities.xml is touched. */
export type PendingResolution =
  | { status: 'resolving' }
  | {
      status: 'confirm';
      plan: Extract<LookupResolutionPlan, { action: 'link' }>;
      input: LookupSelectionInput;
    }
  | { status: 'conflict'; candidates: LookupConflictCandidate[]; input: LookupSelectionInput }
  | { status: 'error'; message: string };

export const resolutionAtom = atomWithReset<PendingResolution | null>(null);
resolutionAtom.debugLabel = 'resolution.Atom';

export const onCloseAtom = atom<
  ((response?: EntityLink | Pick<EntityLink, 'query' | 'type'>) => void) | undefined
>(undefined);
onCloseAtom.debugLabel = 'onClose.Atom';
