import { db } from '../../../../db';
import type { LookupServicePreference, NamedEntityType } from '../../../../types';

export const useLookupServicePrefeneces = () => {
  const toggleLookupEntity = async (authorityId: string, entityType: NamedEntityType) => {
    const entityTypePreference = await db.lookupServicePreferences.get(
      `${authorityId}:${entityType}`,
    );
    if (!entityTypePreference) return;

    db.lookupServicePreferences.update(`${authorityId}:${entityType}`, {
      disabled: !entityTypePreference.disabled,
    });
  };

  const reorderLookupPriority = (servicePreferences: LookupServicePreference[]) => {
    db.lookupServicePreferences.bulkUpdate(
      servicePreferences.map((servicePreference, index) => ({
        key: `${servicePreference.authorityId}:${servicePreference.entityType}`,
        changes: { priority: index },
      })),
    );
  };

  return {
    toggleLookupEntity,
    reorderLookupPriority,
  };
};
