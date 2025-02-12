import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import { authoritiesInitialConfig } from '../../config/authorities';
import { db } from '../../db';
import {
  namedEntityTypesSchema,
  type AuthorityService,
  type AuthorityServiceConfig,
  type AuthorityServices,
  type EntityLookupDialogProps,
  type NamedEntityType,
} from '../../types';
import { log } from '../../utilities';

export const entityLookupDialogAtom = atomWithReset<EntityLookupDialogProps | null>(null);
entityLookupDialogAtom.debugLabel = 'entityLookupDialog.Atom';

//  -----

export const authorityServicesAtom = atom<AuthorityServices>(new Map());
authorityServicesAtom.debugLabel = 'authorityServices.Atom';

// * -- Cache AuthorityServiceConfig just in case reset to default
let _configAuthorityServices: AuthorityServiceConfig[] | undefined = undefined;

export const configureAuthorityServicesAtom = atom(
  null,
  async (_get, set, configAuthorityServices?: AuthorityServiceConfig[]) => {
    const authorityServices: AuthorityServices = authoritiesInitialConfig.reduce(
      (map: AuthorityServices, obj: AuthorityService) => {
        map.set(obj.id, structuredClone(obj));
        return map;
      },
      new Map(),
    );

    if (configAuthorityServices) {
      _configAuthorityServices = configAuthorityServices;
    } else {
      configAuthorityServices = _configAuthorityServices;
    }

    //* no config, use default
    if (!configAuthorityServices) {
      set(authorityServicesAtom, authorityServices);
      applyUserPreferencesAuthorityServices(authorityServices);
      return;
    }

    //* config services
    configAuthorityServices.forEach((serviceConfig) => {
      // * If it is just a mention to a suportted authority, enabled it.
      if (typeof serviceConfig === 'string') {
        authorityServices.get(serviceConfig)!.disabled = false;
        return;
      }

      // * Get authority service to configure
      const authorityService = authorityServices.get(serviceConfig.id);

      // * Implements new authority service
      if (!authorityService) {
        //TODO Check implementation of new authority service via extension/addons
        authorityServices.set(serviceConfig.id, serviceConfig);
        return;
      }

      //* Enable/Disable service
      authorityService.disabled = serviceConfig.disabled;

      //*  No entities, use default
      if (!serviceConfig.entities) return;

      //* entity types
      for (const entity in serviceConfig.entities) {
        const isNamedEntityType = namedEntityTypesSchema.safeParse(entity);
        if (!isNamedEntityType.success) continue;

        const namedEntityType = isNamedEntityType.data;
        if (!authorityService.entities[namedEntityType]) continue;
        if (!Object.prototype.hasOwnProperty.call(serviceConfig.entities, entity)) continue;

        const value = serviceConfig.entities[namedEntityType];
        if (value) authorityService.entities[namedEntityType] = value;
      }
    });

    //* setup current
    set(authorityServicesAtom, authorityServices);
    applyUserPreferencesAuthorityServices(authorityServices);
  },
);

export const applyUserPreferencesAuthorityServices = async (
  authorityServices: AuthorityServices,
) => {
  //* No user preferences, add once.
  const count = await db.authorityServices.count();

  if (count === 0) {
    const preferences: AuthorityService[] = Array.from(authorityServices.values());
    const saninatizedPreferences = sanitazeAuthorityServices(preferences);
    await db.authorityServices.bulkAdd(saninatizedPreferences);
    return;
  }

  const preferences = await db.authorityServices.toArray();

  for (const servicePreference of preferences) {
    // * Get authority service to configure
    const authorityService = authorityServices.get(servicePreference.id);

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

    await db.authorityServices.update(servicePreference.id, {
      priority: servicePreference.priority,
      disabled: servicePreference.disabled,
    });

    //*  No entities, use default
    if (!servicePreference.entities) continue;

    //* entity types
    const entitiesToRemove: NamedEntityType[] = [];
    for (const entity in servicePreference.entities) {
      const isNamedEntityType = namedEntityTypesSchema.safeParse(entity);
      if (!isNamedEntityType.success) continue;

      const namedEntityType = isNamedEntityType.data;
      if (!Object.prototype.hasOwnProperty.call(servicePreference.entities, entity)) continue;
      if (!authorityService.entities[namedEntityType]) {
        log.warn(
          `Authority Service Preferences: authority ${servicePreference.id} no longer accept entity ${entity}`,
        );

        entitiesToRemove.push(namedEntityType);
        delete servicePreference.entities[namedEntityType];
        continue;
      }

      const value = servicePreference.entities[namedEntityType];
      if (value !== undefined) authorityService.entities[namedEntityType] = value;
    }

    await db.authorityServices.update(servicePreference.id, {
      entities: servicePreference.entities,
    });
  }
};

export const toggleLookupAuthorityAtom = atom(null, (get, set, authorityId: string) => {
  const authorityServices = get(authorityServicesAtom);
  const authorityService = authorityServices.get(authorityId);
  if (!authorityService) return;

  authorityService.disabled = !authorityService.disabled;
  db.authorityServices.update(authorityId, { disabled: authorityService.disabled });

  set(authorityServicesAtom, authorityServices);
});

export const toggleLookupEntityAtom = atom(
  null,
  (get, set, { authorityId, entityName }: { authorityId: string; entityName: NamedEntityType }) => {
    const authorityServices = get(authorityServicesAtom);
    const authorityService = authorityServices.get(authorityId);
    if (!authorityService) return;

    authorityService.entities[entityName] = !authorityService.entities[entityName];

    db.authorityServices.update(authorityId, {
      entities: authorityService.entities,
    });

    set(authorityServicesAtom, authorityServices);
  },
);

export const reorderLookupPriorityAtom = atom(null, (get, set, authorities: AuthorityService[]) => {
  const authorityServices = get(authorityServicesAtom);
  authorities.forEach((authority, index) => {
    const authorityService = authorityServices.get(authority.id);
    if (authorityService) authorityService.priority = index;
  });

  const preferences: AuthorityService[] = Array.from(authorityServices.values());

  const saninatizedPreferences = sanitazeAuthorityServices(preferences);
  db.authorityServices.bulkPut(saninatizedPreferences);

  set(authorityServicesAtom, authorityServices);
});

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
