import { useLiveQuery } from 'dexie-react-hooks';
import { useSetAtom } from 'jotai';
import { customAlphabet } from 'nanoid';
import { useMemo } from 'react';
import { db } from '../../db';
import { authorityServicesAtom } from '../../jotai/entity-lookup';
import { useAppState } from '../../overmind';
import { teiFileBasedSearch } from '../../services/loader-authority-tei';
import { type LocalAuthorityServiceConfig } from '../../types';
import { slugify } from '../../utilities';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 21);

export const useCustomAuthorityDialog = (authorityId?: string) => {
  const user = useAppState().user;

  const setAuthorityServices = useSetAtom(authorityServicesAtom);

  const defaultValue: LocalAuthorityServiceConfig = useMemo(() => {
    return {
      name: '',
      description: '',
      author: { name: user.name, url: user.uri },
      entityTypes: [],
      id: nanoid(8),
      searchType: 'TEI-FILE',
      options: {
        maxResults: 10,
      },
    };
  }, []);

  const initialValue: LocalAuthorityServiceConfig = useLiveQuery(
    async () => {
      if (!authorityId) return defaultValue;
      const authority = await db.customAuthorityServices.get(authorityId);
      return authority ?? defaultValue;
    },
    [authorityId],
    defaultValue,
  );

  const addAuthority = async (values: LocalAuthorityServiceConfig) => {
    //* 1. Generate id based on name and random id
    values.id = `${slugify(values.name, '_')}_${values.id}`;

    //* 2. Add authority service to the authorityServices atom
    addAuthorityToAuthorityServicesAtom(values);

    //* 3. Save authority service into IndexedDB: customAuthorityServices table
    await db.customAuthorityServices.put(values, values.id);

    //* 4. Save each authority service entity types preferences into IndexedDB: lookupServicePreferences table
    for (const entityType of values.entityTypes) {
      await db.lookupServicePreferences.put({
        id: `${values.id}:${entityType.name}`,
        authorityId: values.id,
        entityType: entityType.name,
        priority: Infinity,
        disabled: false,
      });
    }
  };

  const addAuthorityToAuthorityServicesAtom = (values: LocalAuthorityServiceConfig) => {
    //* 2.1 Transform entityTypes into a Map
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { searchType, entityTypes, ...rest } = values;

    const entityTypesProp = new Map(
      entityTypes.map((entityType) => [
        entityType.name,
        { name: entityType.name, url: entityType.url },
      ]),
    );

    //* 2.2 Bind search TEI-file-based functionality to the authority service config
    const func = teiFileBasedSearch.bind(values);

    //* 2.3 Add authority service to the authorityServices atom
    setAuthorityServices((prev) => {
      prev.set(values.id, {
        search: func,
        entityTypes: entityTypesProp,
        isCustom: true,
        isLocal: true,
        ...rest,
      });
      return prev;
    });
  };

  const updateAuthority = async (values: LocalAuthorityServiceConfig) => {
    //* 1. Update authority service in the authorityServices atom
    const entityTypesProp = new Map(
      values.entityTypes.map((entityType) => [
        entityType.name,
        { name: entityType.name, url: entityType.url },
      ]),
    );

    //* 1.1 Update authority service in the authorityServices atom
    setAuthorityServices((prev) => {
      const service = prev.get(values.id);
      if (!service) return prev;

      prev.set(values.id, {
        ...service,
        entityTypes: entityTypesProp,
        description: values.description,
      });
      return prev;
    });

    //* 2. Update authority service in IndexedDB: customAuthorityServices table
    await db.customAuthorityServices.put(values, values.id);

    //* 3. Remove authority service entity types preferences from IndexedDB: lookupServicePreferences table
    const currentLookupServicePreferences = await db.lookupServicePreferences
      .where({ authorityId: values.id })
      .toArray();
    for (const service of currentLookupServicePreferences) {
      const serviceEstablished = values.entityTypes.some((e) => e.name === service.entityType);
      if (!serviceEstablished) {
        await db.lookupServicePreferences.delete(service.id);
      }
    }

    //* 4. Update each authority service entity types preferences in IndexedDB: lookupServicePreferences table
    for (const entityType of values.entityTypes) {
      const currentValue = await db.lookupServicePreferences.get(`${values.id}:${entityType.name}`);
      await db.lookupServicePreferences.put({
        id: `${values.id}:${entityType.name}`,
        authorityId: values.id,
        entityType: entityType.name,
        priority: currentValue?.priority ?? Infinity,
        disabled: currentValue?.disabled ?? false,
      });
    }
  };

  const deleteAuthority = async () => {
    if (!authorityId) return;

    setAuthorityServices((prev) => {
      prev.delete(authorityId);
      return prev;
    });

    await db.customAuthorityServices.delete(authorityId);
    await db.lookupServicePreferences.where({ authorityId }).delete();
  };

  return {
    deleteAuthority,
    initialValue,
    addAuthority,
    updateAuthority,
  };
};
