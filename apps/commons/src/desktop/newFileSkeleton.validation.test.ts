import fetchMock from 'jest-fetch-mock';
import Validator from '../../../../packages/cwrc-leafwriter-validator/src/Validator';
import { WorkingState } from '@cwrc/salve-dom-leafwriter';
import { schemas as catalogSchemas } from '../../../../packages/cwrc-leafwriter/src/config/schemas';
import { mergeMetadataIntoSkeleton } from './projectMetadata';
import { buildSkeletonForCatalog } from './schemaTemplates';
import type { ProjectMetadataFile } from './projectTypes';

type EnabledCatalogId = 'teiAll' | 'teiLite' | 'teiSimplePrint' | 'jTei' | 'orlando';

const catalogConfig: Record<
  EnabledCatalogId,
  { catalogId: EnabledCatalogId; css: string; rng: string }
> = {
  teiAll: { catalogId: 'teiAll', rng: 'schema/tei_all.rng', css: 'schema/tei.css' },
  teiLite: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
  teiSimplePrint: {
    catalogId: 'teiSimplePrint',
    rng: 'schema/tei_simplePrint.rng',
    css: 'schema/tei.css',
  },
  jTei: { catalogId: 'jTei', rng: 'schema/tei_jtei.rng', css: 'schema/tei.css' },
  orlando: { catalogId: 'orlando', rng: 'schema/orlando_entry.rng', css: 'schema/orlando.css' },
};

const sampleMetadata = (catalogId: EnabledCatalogId): ProjectMetadataFile => {
  if (catalogId === 'orlando') {
    return {
      version: 1,
      catalogId: 'orlando',
      fields: { 'REVISIONDESC/RESPONSIBILITY': 'Test Encoder' },
      custom: [],
    };
  }

  if (catalogId === 'teiSimplePrint' || catalogId === 'jTei') {
    return {
      version: 1,
      catalogId,
      fields: { 'publicationStmt/distributor': 'Example Press' },
      custom: [],
    };
  }

  return {
    version: 1,
    catalogId,
    fields: { 'titleStmt/principal': 'Test Encoder' },
    custom: [],
  };
};

const buildNewFileXml = (catalogId: EnabledCatalogId) => {
  const skeleton = buildSkeletonForCatalog({ schema: catalogConfig[catalogId] });
  if (catalogId === 'teiAll' || catalogId === 'teiLite') {
    return mergeMetadataIntoSkeleton(skeleton, sampleMetadata(catalogId));
  }
  return skeleton;
};

describe('new file skeleton RelaxNG validation', () => {
  const RUN_LIVE = process.env.TEI_LIVE_TEST === '1';

  if (!RUN_LIVE) {
    test.skip('live TEI catalog validation is opt-in (set TEI_LIVE_TEST=1)', () => {});
    return;
  }

  jest.setTimeout(120_000);

  beforeEach(() => {
    Validator.reset();
    fetchMock.disableMocks();
  });

  afterEach(() => {
    fetchMock.enableMocks();
  });

  test.each([
    'teiAll',
    'teiLite',
    'teiSimplePrint',
    'jTei',
    'orlando',
  ] as const)(
    'validates merged skeleton against %s catalog RNG (requires network)',
    (catalogId) =>
      new Promise<void>((resolve, reject) => {
        const catalogEntry = catalogSchemas.find((entry) => entry.id === catalogId);
        if (!catalogEntry?.rng[0]) {
          reject(new Error(`Missing catalog RNG for ${catalogId}`));
          return;
        }

        void (async () => {
          const { success } = await Validator.initialize({
            id: catalogId,
            url: catalogEntry.rng[0],
          });
          if (!success) {
            reject(new Error(`Failed to initialize validator for ${catalogId}`));
            return;
          }

          const xml = buildNewFileXml(catalogId);
          Validator.validate(xml, ({ state, valid, errors }) => {
            if (state === WorkingState.VALID && valid) {
              resolve();
            }
            if (state === WorkingState.INVALID) {
              const detail = errors?.length
                ? JSON.stringify(errors.slice(0, 3))
                : 'unknown';
              reject(new Error(`Skeleton invalid for ${catalogId}: ${detail}`));
            }
          });
        })().catch(reject);
      }),
  );
});
