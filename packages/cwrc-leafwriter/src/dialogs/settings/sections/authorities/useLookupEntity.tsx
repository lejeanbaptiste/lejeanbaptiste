import { db } from '../../../../db';

export const useLookupServicePrefeneces = () => {
  const toggleAuthority = async (authorityId: string) => {
    const preferencesForAuthority = await db.lookupServicePreferences
      .where({ authorityId })
      .toArray();

    if (preferencesForAuthority.length === 0) return;

    const isAllEntityTypesDisabled =
      preferencesForAuthority.every((type) => type.disabled === true) ?? false;

    db.lookupServicePreferences.bulkUpdate(
      preferencesForAuthority.map((type) => ({
        key: `${authorityId}-${type.entityType}`,
        changes: {
          disabled: !isAllEntityTypesDisabled,
          priority: Infinity,
        },
      })),
    );
  };

  return {
    toggleAuthority,
  };
};
