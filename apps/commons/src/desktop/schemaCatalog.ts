import { schemas as catalogSchemas } from '../../../../packages/cwrc-leafwriter/src/config/schemas';

export const PRIMARY_CATALOG_IDS = ['teiAll', 'teiLite'] as const;
export const MORE_CATALOG_IDS = ['teiSimplePrint', 'jTei', 'orlando'] as const;
export const ENABLED_CATALOG_IDS = [...PRIMARY_CATALOG_IDS, ...MORE_CATALOG_IDS] as const;

/** @deprecated Use ENABLED_CATALOG_IDS */
export const V1_ENABLED_CATALOG_IDS = PRIMARY_CATALOG_IDS;

export type SchemaSetupTierEntry = {
  id: string;
  name: string;
  enabled: boolean;
  comingSoon?: boolean;
};

export const getTieredCatalogForSetup = (): {
  primary: SchemaSetupTierEntry[];
  more: SchemaSetupTierEntry[];
} => {
  const primarySet = new Set<string>(PRIMARY_CATALOG_IDS);
  const moreSet = new Set<string>(MORE_CATALOG_IDS);

  const primary = catalogSchemas
    .filter((entry) => primarySet.has(entry.id))
    .map((entry) => ({ id: entry.id, name: entry.name, enabled: true }));

  const more = catalogSchemas
    .filter((entry) => moreSet.has(entry.id))
    .map((entry) => ({ id: entry.id, name: entry.name, enabled: true }));

  return { primary, more };
};

export const getCatalogSchemaById = (id: string) =>
  catalogSchemas.find((entry) => entry.id === id);

/** Built-in catalog entries enabled for desktop project flow (schema wizard + editor picker). */
export const getEnabledCatalogSchemas = () =>
  catalogSchemas.filter((entry) =>
    (ENABLED_CATALOG_IDS as readonly string[]).includes(entry.id),
  );
