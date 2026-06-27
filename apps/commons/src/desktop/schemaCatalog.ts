import { schemas as catalogSchemas } from '../../../../packages/cwrc-leafwriter/src/config/schemas';

export const V1_ENABLED_CATALOG_IDS = ['teiAll', 'teiLite'] as const;

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
  const enabledSet = new Set<string>(V1_ENABLED_CATALOG_IDS);
  const moreIds = ['teiSimplePrint', 'jTei', 'orlando'];

  const primary = catalogSchemas
    .filter((entry) => enabledSet.has(entry.id))
    .map((entry) => ({ id: entry.id, name: entry.name, enabled: true }));

  const more = catalogSchemas
    .filter((entry) => moreIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      enabled: false,
      comingSoon: true,
    }));

  return { primary, more };
};

export const getCatalogSchemaById = (id: string) =>
  catalogSchemas.find((entry) => entry.id === id);
