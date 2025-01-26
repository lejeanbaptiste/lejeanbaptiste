import { json } from 'overmind';
import { Context } from '..';
import { db } from '../../db';
import Entity from '../../js/entities/Entity';
import type {
  Authority,
  AuthorityLookupResult,
  AuthorityService,
  AuthorityServiceConfig,
  EntityLink,
  EntryLink,
  NamedEntityType,
} from '../../types';
import { EntityType } from '../../types';
import { log } from './../../utilities';
import { createLincsApiFetcher } from './services/lincs-api';

export const initiate = (
  { state: { lookups }, actions }: Context,
  { entry, type }: { entry?: Entity; type: NamedEntityType },
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

export const configureAuthorityServices = async (
  { state, actions, effects }: Context,
  configAuthorityServices?: AuthorityServiceConfig[],
) => {
  const { authorityServices } = state.lookups;

  //* no config, use default
  if (!configAuthorityServices) {
    effects.editor.api.setDefaultAuthorityServices(json(authorityServices));
    await actions.lookups.applyUserPreferencesAuthrityServices();
    return;
  }

  //* config services
  configAuthorityServices.forEach((serviceConfig) => {
    if (typeof serviceConfig === 'string') {
      authorityServices[serviceConfig];
      return;
    }

    // * Get authority service to configure
    const authorityService = authorityServices[serviceConfig.id];

    // * Implements new authority service
    if (!authorityService) {
      //TODO Implements new authority service
      return;
    }

    //* Disable service
    authorityService.disabled = serviceConfig.disabled;

    //*  No entities, use default
    if (!serviceConfig.entities) return;

    //* entity types
    for (const entity in serviceConfig.entities) {
      if (!authorityService.entities[entity as NamedEntityType]) continue;
      if (!Object.prototype.hasOwnProperty.call(serviceConfig.entities, entity)) continue;

      const value = serviceConfig.entities[entity as NamedEntityType];
      if (value) authorityService.entities[entity as NamedEntityType] = value;
    }
  });

  // * Setup default
  effects.editor.api.setDefaultAuthorityServices(json(authorityServices));
  await actions.lookups.applyUserPreferencesAuthrityServices();
};

export const applyUserPreferencesAuthrityServices = async ({ state }: Context) => {
  const { authorityServices } = state.lookups;

  //* No user preferences, add once.
  const count = await db.authorityServices.count();
  if (count === 0) {
    const preferences: AuthorityService[] = Object.values(json(authorityServices));
    const saninatizedPreferences = sanitazeAuthorityServices(preferences);
    await db.authorityServices.bulkAdd(saninatizedPreferences);
    return;
  }

  const preferences = await db.authorityServices.toArray();

  for (const servicePreference of preferences) {
    // * Get authority service to configure
    const authorityService = authorityServices[servicePreference.id];

    // * Remove not available service from preferences
    if (!authorityService) {
      log.warn(
        `Authority Service Preferences: authority ${servicePreference.id} no longer available `,
      );
      await db.authorityServices.delete(servicePreference.id);
      continue;
    }

    //* Priority
    authorityService.priority = servicePreference.priority;

    //* disabled service
    authorityService.disabled = servicePreference.disabled;

    //*  No entities, use default
    if (!servicePreference.entities) continue;

    //* entity types
    const entitiesToRemove: NamedEntityType[] = [];
    for (const entity in servicePreference.entities) {
      if (!Object.prototype.hasOwnProperty.call(servicePreference.entities, entity)) continue;
      if (!authorityService.entities[entity as NamedEntityType]) {
        log.warn(
          `Authority Service Preferences: authority ${servicePreference.id} no longer accept entity ${entity}`,
        );

        entitiesToRemove.push(entity as NamedEntityType);
        delete servicePreference.entities[entity as NamedEntityType];
        continue;
      }

      const value = servicePreference.entities[entity as NamedEntityType];
      if (value !== undefined) authorityService.entities[entity as NamedEntityType] = value;
    }

    if (entitiesToRemove.length > 0) {
      await db.authorityServices.update(servicePreference.id, {
        entities: servicePreference.entities,
      });
    }
  }
};

export const setType = ({ state: { lookups } }: Context, type: EntityType) => {
  lookups.typeEntity = type;
  lookups.typeLookup = type === 'citation' ? 'work' : (type as NamedEntityType);
};

export const toggleLookupAuthority = async (
  { state: { lookups } }: Context,
  authorityId: string,
) => {
  const authorityService = lookups.authorityServices[authorityId];
  if (!authorityService) return;

  authorityService.disabled = !authorityService.disabled;

  await db.authorityServices.update(authorityId, { disabled: authorityService.disabled });
};

export const toggleLookupEntity = async (
  { state }: Context,
  { authorityId, entityName }: { authorityId: string; entityName: NamedEntityType },
) => {
  const authorityService = state.lookups.authorityServices[authorityId];
  if (!authorityService) return;

  authorityService.entities[entityName] = !authorityService.entities[entityName];

  await db.authorityServices.update(authorityId, {
    entities: json(authorityService.entities),
  });
};

export const reorderLookupPriority = async (
  { state }: Context,
  authorities: AuthorityService[],
) => {
  authorities.forEach((authority, index) => {
    const authorityService = state.lookups.authorityServices[authority.id];
    if (!authorityService) return;
    authorityService.priority = index;
  });

  const preferences: AuthorityService[] = Object.values(json(state.lookups.authorityServices));

  const saninatizedPreferences = sanitazeAuthorityServices(preferences);
  await db.authorityServices.bulkPut(saninatizedPreferences);
};

export const search = async ({ state }: Context, query: string) => {
  if (query === '') return [];

  const authorityServices = state.lookups.authorityServices;

  const enabledAuthorities = Object.values(authorityServices)
    .filter((authority) => !authority.disabled)
    .filter((authority) => authority.entities[state.lookups.typeLookup] === true)
    .toSorted(
      (serviceA, serviceB) => (serviceA.priority ?? Infinity) - (serviceB.priority ?? Infinity),
    );

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

// -----

export const sanitazeAuthorityServices = (services: AuthorityService[]) => {
  const sininatizedPreferences = services.map((service) => {
    if (service.serviceSource !== 'LINCS') {
      const { find, ...rest } = service;
      return rest;
    }
    return service;
  });
  return sininatizedPreferences;
};
