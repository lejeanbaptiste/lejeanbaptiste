import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import { entityStoreFromDesktop } from '../../autoTagging/entityStore';
import {
  applyLookupResolution,
  linkWithoutEnrichment,
  planLookupResolution,
  type LookupResolveDeps,
  type LookupSelectionInput,
} from '../../autoTagging/lookupResolve';
import type { AuthorityPackId } from '../../autoTagging/packPaths';
import { packIdsForEntityType, readPackCached } from '../../services/authority-pack-lookup';
import type { AuthorityLookupResult, EntityLink, NamedEntityType } from '../../types/index';
import { log } from '../../utilities';
import {
  authoritiesAtom,
  entityTypeAtom,
  isUriValidAtom,
  isUserAuthenticatedAtom,
  LookupService,
  lookupTypeAtom,
  manualInputAtom,
  onCloseAtom,
  queryAtom,
  resolutionAtom,
  selectedAtom,
} from './store';

/** Installed (non-virtual) authority packs, for concordance expansion. */
const installedPackIds = async (): Promise<AuthorityPackId[]> => {
  try {
    const statuses = await window.electronAPI?.authorityPackStatuses?.();
    return (statuses ?? []).filter((status) => status.installed).map((status) => status.id);
  } catch {
    return [];
  }
};

const projectSourceLanguage = async (): Promise<string | null> => {
  try {
    const globals = window as unknown as {
      __leafWriterProject?: { getProjectSourceLanguage?: () => Promise<string | null> };
    };
    return (await globals.__leafWriterProject?.getProjectSourceLanguage?.()) ?? null;
  } catch {
    return null;
  }
};

const resolveDeps = async (entityType: NamedEntityType): Promise<LookupResolveDeps | null> => {
  const store = entityStoreFromDesktop();
  if (!store) return null;
  const projectLang = await projectSourceLanguage();
  if (!window.electronAPI?.authorityPackRead) return { store, packIds: [], projectLang };
  // Only scan packs of the right kind, through the session content cache —
  // the concordance scan is the slow part of resolve-on-select.
  const packIds = packIdsForEntityType(await installedPackIds(), entityType);
  return { store, packIds, readPackFile: readPackCached, projectLang };
};

export const useEntityLookup = () => {
  const [authorities, setAuthorities] = useAtom(authoritiesAtom);
  const entityType = useAtomValue(entityTypeAtom);
  const lookupType = useAtomValue(lookupTypeAtom);
  const isUriValid = useAtomValue(isUriValidAtom);
  const isUserAuthenticated = useAtomValue(isUserAuthenticatedAtom);
  const manualInput = useAtomValue(manualInputAtom);
  const onClose = useAtomValue(onCloseAtom);
  const query = useAtomValue(queryAtom);
  const [selected, setSelected] = useAtom(selectedAtom);
  const setResolution = useSetAtom(resolutionAtom);

  const buildLink = (
    over: Partial<EntityLink> & Pick<EntityLink, 'name' | 'uri' | 'repository'>,
  ): EntityLink => ({
    id: over.uri,
    properties: { lemma: over.name, uri: over.uri },
    query,
    type: entityType,
    ...over,
  });

  const selectionInput = (): LookupSelectionInput | null => {
    if (selected) {
      return {
        uri: selected.uri,
        label: selected.label,
        description: selected.description,
        entityType: lookupType,
        query,
      };
    }
    if (manualInput !== '' && isUriValid) {
      return { uri: manualInput, label: query, entityType: lookupType, query };
    }
    return null;
  };

  const closeWith = (link?: EntityLink) => {
    setResolution(RESET);
    onClose?.(link);
  };

  /**
   * Resolve the selection against entities.xml and close, or park in a
   * confirm/conflict state for the user to settle first. Nothing is written
   * before `confirmPendingLink` / `resolveConflict`, except a mint (creating
   * a new entity IS the confirmed action when nothing matched).
   */
  const confirmSelected = async () => {
    const input = selectionInput();
    if (!input) return;

    const plainLink = () =>
      buildLink({
        name: input.label,
        uri: input.uri,
        repository: selected ? selected.authority : 'custom',
      });

    // Picking an entity-database result links directly — no resolution needed.
    if (selected?.internal) {
      closeWith(buildLink({ name: selected.label, uri: selected.uri, repository: 'entity-database', key: selected.internal.id }));
      return;
    }

    const deps = await resolveDeps(lookupType);
    if (!deps) {
      closeWith(plainLink());
      return;
    }

    setResolution({ status: 'resolving' });
    try {
      const plan = await planLookupResolution(input, deps);

      if (plan.action === 'passthrough') {
        closeWith(plainLink());
        return;
      }

      if (plan.action === 'link') {
        setResolution({ status: 'confirm', plan, input });
        return;
      }

      if (plan.action === 'conflict') {
        setResolution({ status: 'conflict', candidates: plan.candidates, input });
        return;
      }

      // mint — the Select click is the confirmation
      const result = await applyLookupResolution(input, deps);
      if (result.status === 'linked') {
        closeWith({ ...plainLink(), key: result.key, wasCreated: result.wasCreated });
      } else if (result.status === 'conflict') {
        setResolution({ status: 'conflict', candidates: result.candidates, input });
      } else {
        closeWith(plainLink());
      }
    } catch (error) {
      log.warn(`Entity lookup resolution failed: ${String(error)}`);
      setResolution({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /** User confirmed linking to the existing entity found by the resolver. */
  const confirmPendingLink = async (input: LookupSelectionInput) => {
    const deps = await resolveDeps(lookupType);
    if (!deps) return;
    setResolution({ status: 'resolving' });
    try {
      // Re-plans against a fresh read — the entity panel may have changed things.
      const result = await applyLookupResolution(input, deps);
      if (result.status === 'linked') {
        closeWith(
          buildLink({
            name: input.label,
            uri: input.uri,
            repository: selected ? selected.authority : 'custom',
            key: result.key,
            wasCreated: result.wasCreated,
          }),
        );
      } else if (result.status === 'conflict') {
        setResolution({ status: 'conflict', candidates: result.candidates, input });
      }
    } catch (error) {
      setResolution({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /** User picked one entity out of a conflict — link it, write no idnos, flag for curation. */
  const resolveConflict = async (
    key: string,
    entityName: string,
    candidates: { key: string; name: string; description?: string }[],
    input: LookupSelectionInput,
  ) => {
    const deps = await resolveDeps(lookupType);
    if (!deps) return;
    setResolution({ status: 'resolving' });
    try {
      await linkWithoutEnrichment(key, entityName, candidates, input, deps);
      closeWith(
        buildLink({
          name: input.label,
          uri: input.uri,
          repository: selected ? selected.authority : 'custom',
          key,
        }),
      );
    } catch (error) {
      setResolution({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /** Fall back to today's behavior: plain URI link, entities.xml untouched. */
  const linkWithoutDatabase = () => {
    const input = selectionInput();
    if (!input) return closeWith();
    closeWith(
      buildLink({
        name: input.label,
        uri: input.uri,
        repository: selected ? selected.authority : 'custom',
      }),
    );
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
    setResolution(RESET);

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
    confirmSelected,
    confirmPendingLink,
    resolveConflict,
    linkWithoutDatabase,
    search,
  };
};
