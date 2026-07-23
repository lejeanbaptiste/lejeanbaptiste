import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
} from '../../autoTagging/entityStore';
import {
  applyLookupResolution,
  appendExtraAuthorityIds,
  linkLocalEntityWithoutAuthority,
  linkWithoutEnrichment,
  planLookupResolution,
  type LookupResolveDeps,
  type LookupSelectionInput,
} from '../../autoTagging/lookupResolve';
import type { AuthorityPackId } from '../../autoTagging/packPaths';
import { adoptFromCentral } from '../../autoTagging/promote';
import { readOrMintUserStableId } from '../../autoTagging/userStableId';
import { packIdsForEntityType, readPackCached } from '../../services/authority-pack-lookup';
import { centralEntityIdFromUri } from '../../services/central-entity-database-lookup';
import { internalEntityUri } from '../../services/entity-database-lookup';
import type { AuthorityLookupResult, EntityLink, NamedEntityType } from '../../types/index';
import { log } from '../../utilities';
import {
  authoritiesAtom,
  checkedEntriesAtom,
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
import type { EntryLink } from '../../types/authority';

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

/**
 * A CEDB candidate has no representation in this project yet — mint (or reuse)
 * a linked project entity for it before resolving, so it behaves like any
 * other project entity from here on. Returns null when the central database
 * isn't reachable (no folder configured, no project open).
 */
const adoptCentralEntity = async (centralId: string): Promise<string | null> => {
  const projectStore = entityStoreFromDesktop();
  const api = desktopEntityFileApi();
  if (!projectStore || !api) return null;

  const centralFolder = (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
  const centralStore = centralEntityStoreFromDesktop(centralFolder);
  if (!centralStore) return null;

  const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
  const [pedbDoc, cedbDoc] = await Promise.all([
    projectStore.loadEntities(),
    centralStore.loadEntities(),
  ]);
  const { pedbId, created } = adoptFromCentral(pedbDoc, centralId, cedbDoc, userStableId);
  if (created) await projectStore.saveEntities(pedbDoc);
  return pedbId;
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
  const [checkedEntries, setCheckedEntries] = useAtom(checkedEntriesAtom);
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

  /**
   * When one or more candidates are checked, the primary is whichever one is
   * a project/central entity (if any — it's the thing that gets linked
   * directly), otherwise the first checked. Every other checked candidate's
   * uri is carried as `extraUris`, so its authority id gets attached to
   * whatever entity the primary resolves to.
   */
  const checkedPrimaryAndExtras = (): { primary: EntryLink; extraUris: string[] } | null => {
    const checked = [...checkedEntries.values()];
    if (checked.length === 0) return null;
    const primary = checked.find((entry) => entry.internal) ?? checked[0]!;
    const extraUris = checked.filter((entry) => entry !== primary).map((entry) => entry.uri);
    return { primary, extraUris };
  };

  const selectionInput = (): LookupSelectionInput | null => {
    const checked = checkedPrimaryAndExtras();
    const active = checked?.primary ?? selected;
    if (active) {
      const extraUris = checked?.extraUris ?? [];
      const description = extraUris.length
        ? ([active.description, ...checked!.extraUris.map((uri) =>
            [...checkedEntries.values()].find((entry) => entry.uri === uri)?.description,
          )]
            .filter(Boolean)
            .join(' · ') || undefined)
        : active.description;
      return {
        uri: active.uri,
        label: active.label,
        description,
        entityType: lookupType,
        query,
        extraUris,
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

    const checked = checkedPrimaryAndExtras();
    const active = checked?.primary ?? selected;
    const extraUris = checked?.extraUris ?? [];

    const plainLink = () =>
      buildLink({
        name: input.label,
        uri: input.uri,
        repository: active ? active.authority : 'custom',
      });

    // Picking a project-entity result links directly — no resolution needed.
    if (active?.internal) {
      const attachExtras = async (key: string) => {
        if (extraUris.length === 0) return;
        const deps = await resolveDeps(lookupType);
        if (deps) await appendExtraAuthorityIds(key, extraUris, deps);
      };

      const centralId = centralEntityIdFromUri(active.uri);
      if (centralId) {
        // Picking a central-database result adopts it into this project first —
        // it has no project entity yet — then links to the adopted entity.
        const pedbId = await adoptCentralEntity(centralId);
        if (pedbId) {
          await attachExtras(pedbId);
          closeWith(buildLink({ name: active.label, uri: active.uri, repository: 'entity-database', key: pedbId }));
          return;
        }
        // Central database unreachable — fall through to a plain URI link.
      } else {
        await attachExtras(active.internal.id);
        closeWith(buildLink({ name: active.label, uri: active.uri, repository: 'entity-database', key: active.internal.id }));
        return;
      }
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
            repository: (checkedPrimaryAndExtras()?.primary ?? selected)?.authority ?? 'custom',
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
          repository: (checkedPrimaryAndExtras()?.primary ?? selected)?.authority ?? 'custom',
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

  /** Tag the surface with a project entity @key, without an external authority URI. */
  const tagWithoutLinking = async () => {
    const trimmed = query.trim();
    if (!trimmed) return closeWith();

    const deps = await resolveDeps(lookupType);
    if (!deps) return closeWith();

    setResolution({ status: 'resolving' });
    try {
      const result = await linkLocalEntityWithoutAuthority(lookupType, trimmed, deps);
      if (result.status === 'linked') {
        closeWith(
          buildLink({
            name: result.entityName,
            uri: internalEntityUri(result.key),
            repository: 'entity-database',
            key: result.key,
            wasCreated: result.wasCreated,
          }),
        );
        return;
      }
      closeWith();
    } catch (error) {
      log.warn(`Local entity tag failed: ${String(error)}`);
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
        repository: (checkedPrimaryAndExtras()?.primary ?? selected)?.authority ?? 'custom',
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
    setCheckedEntries(new Map());
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
    tagWithoutLinking,
    search,
  };
};
