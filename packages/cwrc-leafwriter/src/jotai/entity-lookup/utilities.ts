import { getDefaultStore } from 'jotai';
import { authorityServicesAtom } from '.';
import { authoritiesInitialConfig } from '../../config/authorities';
import { db } from '../../db';
import { teiFileBasedSearch } from '../../services/loader-authority-tei';
import type {
  AuthorityService,
  AuthorityServiceConfig,
  AuthorityServices,
  LookupServicePreference,
  NamedEntityType,
} from '../../types';
import { authorityServiceConfigSchema, localAuthorityServiceConfigSchema } from '../../types';
import { log, slugify } from '../../utilities';

const defaultStore = getDefaultStore();

export const configureAuthorityServices = async (
  customAuthorityServices: AuthorityServiceConfig[] = [],
) => {
  const authorityServices: AuthorityServices = new Map();

  const validCustomServices = validateAuthorityServiceConfig(customAuthorityServices);

  authoritiesInitialConfig
    .map((service) => convertConfigIntoServiceObject(service))
    .forEach((service) => {
      authorityServices.set(service.id, service);
    });

  validCustomServices
    .map((service) => convertConfigIntoServiceObject(service, { isCustom: true }))
    .forEach((service) => {
      authorityServices.set(service.id, service);
    });

  //custom local custom authority services
  (await getLocalCustomAuthorityServices()).forEach((service) => {
    authorityServices.set(service.id, service);
  });

  // store authority services in memory
  defaultStore.set(authorityServicesAtom, authorityServices);

  // chekc if user has preferences set
  const lookupServicePreferencesCount = await db.lookupServicePreferences.count();
  if (lookupServicePreferencesCount === 0) {
    initializeLookupPreferences(authorityServices);
  } else {
    updateLookupPreferences(authorityServices);
  }
};

const validateAuthorityServiceConfig = (services: AuthorityServiceConfig[]) => {
  const validCustomServices: AuthorityServiceConfig[] = [];
  services.forEach((service) => {
    const validatedService = authorityServiceConfigSchema.safeParse(service);
    if (!validatedService.success) {
      log.warn(`Invalid custom authority service: ${JSON.stringify(service)}`);
      return null;
    }
    validCustomServices.push(validatedService.data);
  });
  return validCustomServices;
};

const convertConfigIntoServiceObject = (
  config: AuthorityServiceConfig,
  options?: { isCustom: boolean },
) => {
  const { entityTypes, ...rest } = config;

  const id = slugify(config.name);
  const entityTypesProp = new Map();
  entityTypes?.forEach((entityType) => {
    if (typeof entityType === 'string') {
      entityTypesProp.set(entityType, { name: entityType });
      return;
    }
    const { priority, ...rest } = entityType;
    entityTypesProp.set(entityType.name, rest);
  });

  const service: AuthorityService = { id, entityTypes: entityTypesProp, ...rest };
  if (options?.isCustom) service.isCustom = true;

  return service;
};

const getLocalCustomAuthorityServices = async () => {
  const services: AuthorityService[] = [];

  const customAuthorityServices = await db.customAuthorityServices.toArray();

  customAuthorityServices.forEach((customService) => {
    const validatedService = localAuthorityServiceConfigSchema.safeParse(customService);
    if (!validatedService.success) return;

    const { searchType, entityTypes, ...rest } = customService;
    if (searchType !== 'TEI-FILE') return;

    const entityTypesProp = new Map(
      entityTypes.map((entityType) => [
        entityType.name,
        { name: entityType.name, url: entityType.url },
      ]),
    );

    //* bind search TEI-file-based functionality to the authority service config
    const func = teiFileBasedSearch.bind(customService);

    services.push({
      search: func,
      entityTypes: entityTypesProp,
      isCustom: true,
      isLocal: true,
      ...rest,
    });
  });

  return services;
};

export const initializeLookupPreferences = async (authorityServices: AuthorityServices) => {
  const lookupPreferences: LookupServicePreference[] = [];

  Array.from(authorityServices.values()).forEach(({ id, name, entityTypes }) => {
    const intServ = authoritiesInitialConfig.find((s) => s.name === name);

    entityTypes.forEach(({ name: entityType }) => {
      let priority = Infinity;

      intServ?.entityTypes.forEach((type) => {
        typeof type !== 'string' &&
          type.name === entityType &&
          (priority = type.priority ?? Infinity);
      });

      lookupPreferences.push({
        id: `${id}-${entityType}`,
        authorityId: id,
        entityType,
        priority,
        disabled: false,
      });
    });
  });

  await db.lookupServicePreferences.bulkPut(lookupPreferences);
};

const updateLookupPreferences = async (authorityServices: AuthorityServices) => {
  // * Authorities
  const lookupServicePreferences = await db.lookupServicePreferences.toArray();

  //* DELETE if necessary: Check for deleted services, removed entity types
  for (const servicePreference of lookupServicePreferences) {
    // * Get authority service to configure
    const authorityService = authorityServices.get(servicePreference.authorityId);

    // * Remove no longer available authority service from preferences
    if (!authorityService) {
      log.warn(`Authority service ${servicePreference.authorityId} no longer available `);
      db.lookupServicePreferences.where({ authorityId: servicePreference.authorityId }).delete();
      continue;
    }

    // * Get authority service entity types to configure
    const authorityEntityTypes = authorityService.entityTypes.get(servicePreference.entityType);

    // * Remove no longer available authority entity type from preferences
    if (!authorityEntityTypes) {
      log.warn(
        `Authority service for entity type ${servicePreference.entityType} no longer available in authority ${servicePreference.authorityId}`,
      );
      db.lookupServicePreferences
        .where({
          authorityId: servicePreference.authorityId,
          entityType: servicePreference.entityType,
        })
        .delete();
    }
  }

  //* ADD IF NECESSARY: Check for non existing services or entity types on existing services
  for (const [, authorityService] of authorityServices) {
    const servicePreference = lookupServicePreferences.filter(
      (servicePreference) => servicePreference.authorityId === authorityService.id,
    );

    // * Add new authority service
    if (servicePreference.length === 0) {
      const intServ = authoritiesInitialConfig.find((s) => s.name === authorityService.name);
      const lookupPreferences: LookupServicePreference[] = [];

      authorityService.entityTypes.forEach(({ name: entityType }) => {
        let priority = Infinity;

        intServ?.entityTypes.forEach((type) => {
          typeof type !== 'string' &&
            type.name === entityType &&
            (priority = type.priority ?? Infinity);
        });

        lookupPreferences.push({
          id: `${authorityService.id}-${entityType}`,
          authorityId: authorityService.id,
          entityType,
          priority,
        });
      });
      db.lookupServicePreferences.bulkAdd(lookupPreferences);
      continue;
    }

    //* Add new authority service for entity type if not present
    const entityTypeToBeAdded: NamedEntityType[] = [];

    authorityService.entityTypes.forEach((serviceEntityType) => {
      const serviceEntityTypeExists = servicePreference.some(
        ({ entityType }) => entityType === serviceEntityType.name,
      );
      if (!serviceEntityTypeExists) entityTypeToBeAdded.push(serviceEntityType.name);
    });

    if (entityTypeToBeAdded.length > 0) {
      const intServ = authoritiesInitialConfig.find((s) => s.name === authorityService.name);
      const lookupPreferences: LookupServicePreference[] = [];

      entityTypeToBeAdded.forEach((entityType) => {
        let priority = Infinity;

        intServ?.entityTypes.forEach((type) => {
          typeof type !== 'string' &&
            type.name === entityType &&
            (priority = type.priority ?? Infinity);
        });

        lookupPreferences.push({
          id: `${authorityService.id}-${entityType}`,
          authorityId: authorityService.id,
          entityType,
          priority,
        });
      });
      db.lookupServicePreferences.bulkAdd(lookupPreferences);
    }
  }

  return authorityServices;
};

export const resetLookupPreferences = async () => {
  await initializeLookupPreferences(defaultStore.get(authorityServicesAtom));
};
