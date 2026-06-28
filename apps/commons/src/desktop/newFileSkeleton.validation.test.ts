import fetchMock from 'jest-fetch-mock';
import Validator from '../../../../packages/cwrc-leafwriter-validator/src/Validator';
import { WorkingState } from '@cwrc/salve-dom-leafwriter';
import { schemas as catalogSchemas } from '../../../../packages/cwrc-leafwriter/src/config/schemas';
import { mergeMetadataIntoHeader } from './projectMetadata';
import { buildTeiSkeletonXml } from './schemaTemplates';
import type { ProjectMetadataFile } from './projectTypes';

const sampleMetadata: ProjectMetadataFile = {
  version: 1,
  catalogId: 'teiLite',
  fields: { 'titleStmt/principal': 'Test Encoder' },
  custom: [],
};

const buildNewFileXml = (catalogId: 'teiAll' | 'teiLite') => {
  const config = {
    schema: {
      catalogId,
      rng: catalogId === 'teiAll' ? 'schema/tei_all.rng' : 'schema/tei_lite.rng',
      css: 'schema/tei.css',
    },
  };
  return mergeMetadataIntoHeader(buildTeiSkeletonXml(config), sampleMetadata);
};

describe('new file skeleton RelaxNG validation', () => {
  jest.setTimeout(120_000);

  beforeEach(() => {
    Validator.reset();
    fetchMock.disableMocks();
  });

  afterEach(() => {
    fetchMock.enableMocks();
  });

  test.each(['teiAll', 'teiLite'] as const)(
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
          Validator.validate(xml, ({ state, valid }) => {
            if (state === WorkingState.VALID && valid) {
              resolve();
            }
            if (state === WorkingState.INVALID) {
              reject(new Error(`Skeleton invalid for ${catalogId}`));
            }
          });
        })().catch(reject);
      }),
  );
});
