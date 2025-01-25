import { Context } from '..';
import type {
  Authority,
  AuthorityLookupResult,
  EntityLink,
  EntryLink,
  NamedEntityType,
} from '../../dialogs/entityLookups/types';
import type { DialogLookupType } from '../../js/dialogs/types';
import Entity from '../../js/entities/Entity';
import { EntityType } from '../../types';
import { createLincsApiFetcher } from './services/lincs-api';

export const initiate = (
  { state: { lookups }, actions }: Context,
  { entry, type }: { entry?: Entity; type: DialogLookupType },
) => {
  actions.lookups.setType(type);

  if (entry) {
    const query = entry.getContent()?.trim() ?? '';
    lookups.query = query;
  } else {
    const currentBookmark = window.writer?.editor?.currentBookmark;
    if (!currentBookmark) return;

    if ('rng' in currentBookmark) {
      let query = currentBookmark.rng.toString();
      query = query.trim().replace(/\s+/g, ' '); // remove excess whitespace
      lookups.query = query;
    }
  }

  void actions.lookups.search(lookups.query);
};

export const setType = ({ state: { lookups } }: Context, type: EntityType) => {
  lookups.typeEntity = type;
  lookups.typeLookup = type === 'citation' ? 'work' : (type as NamedEntityType);
};

export const search = async ({ state }: Context, query: string) => {
  if (query === '') return [];

  const authorityServices = state.editor.authorityServices;

  const enabledAuthorities = Object.values(authorityServices)
    .filter((authority) => !authority.disabled)
    .filter((authority) => authority.entities[state.lookups.typeLookup] === true)
    .toSorted((serviceA, serviceB) => serviceA.priority - serviceB.priority);

  const authorityServedByLincs = enabledAuthorities.filter(
    (authority) => authority.serviceSource === 'LINCS',
  );

  const customAuthoritiesFetchers = enabledAuthorities
    .filter((authority) => authority.serviceSource !== 'LINCS')
    .map(({ find }) => find);

  const isUserRegistered = state.user.uri !== '#anonymous';
  const lincsApiFetcher = createLincsApiFetcher({
    entityType: state.lookups.typeLookup,
    authorities: authorityServedByLincs,
    moreResults: isUserRegistered,
  });

  await Promise.allSettled([
    lincsApiFetcher(query),
    ...customAuthoritiesFetchers.map((fetch) => fetch({ query, type: state.lookups.typeLookup })),
  ]).then((responses) => {
    let allResults = new Map<Authority | (string & {}), AuthorityLookupResult[]>();

    responses.forEach((response) => {
      if (response.status !== 'fulfilled') return;

      if (Array.isArray(response.value)) {
        if (response.value.length > 0) {
          allResults.set(response.value[0].authority, response.value);
        }
        return;
      }

      allResults = new Map([...allResults, ...response.value]);
    });

    const prioritizedResults = new Map();

    enabledAuthorities.forEach((authority) => {
      const results = allResults.get(authority.id);
      if (!results) return;
      prioritizedResults.set(authority.id, results);
    });

    state.lookups.results = prioritizedResults;
    return prioritizedResults;
  });

  // const listPriority = [...customAuthorities, ...authorityServedByLincs].toSorted(
  //   (serviceA, serviceB) => serviceA.priority - serviceB.priority,
  // );

  // await Promise.allSettled(
  //   listPriority.map(async ({ disabled, entities, id, ...authority }) => {
  //     if (disabled || !entities[state.lookups.typeLookup]) return;

  //     if (authority.serviceSource === 'LINCS') {
  //       console.log('LINCS');
  //       console.log(authority);
  //       //TODO - implement LINCS
  //     } else {
  //       results.set(id, []); //* guarantee the priority order
  //       const response = await authority.find?.({ query, type: state.lookups.typeLookup });
  //       if (response) results.set(id, response);
  //     }
  //   }),
  // );
};

export const processSelected = ({ state: { lookups } }: Context) => {
  let link: EntityLink | undefined;

  if (lookups.selected) {
    const { uri: id, label: name, authority: repository, uri } = lookups.selected;
    link = {
      id,
      name,
      properties: { lemma: name, uri },
      query: lookups.query,
      repository,
      type: lookups.typeEntity,
      uri,
    };
  }

  if (lookups.manualInput !== '' && lookups.isUriValid) {
    link = {
      id: lookups.manualInput,
      name: lookups.query,
      properties: { lemma: lookups.query, uri: lookups.manualInput },
      query: lookups.query,
      repository: 'custom',
      type: lookups.typeEntity,
      uri: lookups.manualInput,
    };
  }

  return link;
};

export const setSelected = ({ state: { lookups } }: Context, link?: EntryLink) => {
  lookups.selected = link;
  lookups.manualInput = '';
};

export const setQuery = ({ state: { lookups } }: Context, value: string) => {
  lookups.query = value;
};

export const setManualInput = ({ state: { lookups } }: Context, value: string) => {
  lookups.manualInput = value;
};

export const reset = ({ state: { lookups } }: Context) => {
  lookups.manualInput = '';
  lookups.query = '';
  lookups.results = undefined;
  lookups.selected = undefined;
  lookups.typeEntity = 'thing';
  lookups.typeLookup = 'thing';
};
