import { WorkingState } from '@cwrc/salve-dom-leafwriter';
import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import fetchMock from 'jest-fetch-mock';
import Validator from '../src/Validator';
import { deleteDb } from '../src/db';
import { log, logEnabledFor } from '../src/log';
import type { NodeDetail } from '../src/types';
import { cwrcTeiLite } from './mocks';

beforeAll(() => {
  global.console = {
    ...console,
    time: jest.fn(),
    groupCollapsed: jest.fn(),
  };
});

beforeEach(() => {
  jest.restoreAllMocks();
  fetchMock.mockIf(cwrcTeiLite.url, () => {
    return new Promise((resolve) => resolve(cwrcTeiLite.schemaXML));
  });
});

describe('Validator', () => {
  describe('general', () => {
    test('log production', async () => {
      expect.assertions(2);

      log.setLevel('SILENT');
      expect(logEnabledFor('INFO')).toBeFalsy();

      log.setLevel('TRACE');
      expect(logEnabledFor('INFO')).toBeTruthy();
    });
  });

  describe('conversion', () => {
    test('load schema from url', async () => {
      expect.assertions(1);

      const { success } = await Validator.initialize({ id: cwrcTeiLite.id, url: cwrcTeiLite.url });
      expect(success).toBe(true);
    });

    test('load schema already loaded', async () => {
      expect.assertions(1);
      const { success } = await Validator.initialize({ id: cwrcTeiLite.id, url: cwrcTeiLite.url });
      expect(success).toBe(true);
    });

    test('load schema from cache', async () => {
      expect.assertions(1);
      Validator.reset();
      const { success } = await Validator.initialize({ id: cwrcTeiLite.id, url: cwrcTeiLite.url });
      expect(success).toBe(true);
    });
  });

  describe('validate', () => {
    test('has no validator', async () => {
      expect.assertions(1);
      expect(Validator.hasValidator()).toBe(false);
    });

    test('Document Valid', (done) => {
      expect.hasAssertions();

      Validator.validate(cwrcTeiLite.documentValid, ({ partDone, state, valid }) => {
        if (state === WorkingState.INCOMPLETE || state === WorkingState.WORKING) {
          expect(partDone).toBeGreaterThanOrEqual(0);
        }

        if (state === WorkingState.VALID) {
          expect(partDone).toBeGreaterThanOrEqual(1);
          expect(valid).toBe(true);
          done();
        }
      });
    });

    test('has validator', async () => {
      expect.assertions(1);
      expect(await Validator.hasValidator()).toBe(true);
    });

    test('Invalid Document', (done) => {
      expect.hasAssertions();

      Validator.validate(cwrcTeiLite.documentWithError, ({ partDone, state, valid, errors }) => {
        if (state === WorkingState.INCOMPLETE || state === WorkingState.WORKING) {
          expect(partDone).toBeGreaterThanOrEqual(0);
        }

        if (state === WorkingState.INVALID) {
          expect(partDone).toBeGreaterThanOrEqual(1);
          expect(valid).toBe(false);

          // Expect 3 error: 1: ElementNameError; 2: AttributeNameError, 3: AttributeValueError
          const errorTypes = ['ElementNameError', 'AttributeNameError', 'AttributeValueError'];

          expect(errors?.length).toBeGreaterThan(0);
          expect(errors?.length).toBe(3);

          errors?.forEach((error, i) => {
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('type', errorTypes[i]);
            expect(error).toHaveProperty('msg', expect.any(String));
            expect(error).toHaveProperty(
              'target',
              expect.objectContaining({
                index: expect.any(Number),
                isAttr: error.type === 'AttributeNameError' ? true : false,
                xpath: expect.any(String),
              }),
            );
            expect(error).toHaveProperty(
              'element',
              expect.objectContaining({
                name: expect.any(String),
                documentation: expect.any(String),
                xpath: expect.any(String),
              }),
            );

            if (error.type === 'AttributeNameError') {
              expect(error).toHaveProperty(
                'element',
                expect.objectContaining({
                  parentElementName: expect.any(String),
                  parentElementXpath: expect.any(String),
                  parentElementIndex: expect.any(Number),
                }),
              );
            }
          });

          done();
        }
      });
    });
  });

  describe('Node', () => {
    describe('getTagAt', () => {
      test('p at /TEI/text/body/div', async () => {
        expect.assertions(1);
        const tag = await Validator.getTagAt('p', '/TEI/text/body/div', 0);

        expect(tag).toEqual({
          documentation: '(paragraph) marks paragraphs in prose. [3.1.  7.2.5. ]',
          eventType: 'enterStartTag',
          fullName: 'paragraph',
          name: 'p',
          ns: 'http://www.tei-c.org/ns/1.0',
          type: 'tag',
        } satisfies NodeDetail);
      });

      test('Invalid xpath', async () => {
        expect.assertions(1);
        const tag = await Validator.getTagAt('p', '/TEI/text/body/divv', 0);
        expect(tag).toBeUndefined();
      });

      test('Tag is not a children ', async () => {
        expect.assertions(1);
        const tag = await Validator.getTagAt('mount', '/TEI/text/body/div', 0);
        expect(tag).toBeUndefined();
      });
    });

    describe('getNodesForTagAt', () => {
      test('/TEI/text/body/div/p', async () => {
        expect.assertions(2);
        const elements = await Validator.getNodesForTagAt('/TEI/text/body/div/p', 0);

        expect(elements).toHaveLength(99);

        expect(elements).toContainEqual({
          documentation: `(arbitrary segment) represents any segmentation of text below the chunk level. [16.3.  6.2.  7.2.5. ]`,
          eventType: 'enterStartTag',
          fullName: 'arbitrary segment',
          name: 'seg',
          ns: 'http://www.tei-c.org/ns/1.0',
          type: 'tag',
        } satisfies NodeDetail);
      });

      test('Invalid xpath', async () => {
        expect.assertions(1);
        const tag = await Validator.getNodesForTagAt('/TEI/text/body/divv/p', 0);
        expect(tag).toBeUndefined();
      });
    });

    describe('getAttributesForTagAt', () => {
      test('/TEI/text/body/div/p', async () => {
        expect.assertions(2);
        const attributes = await Validator.getAttributesForTagAt('/TEI/text/body/div/p', 1);
        expect(attributes).toHaveLength(56);

        expect(attributes).toContainEqual({
          documentation: `(responsible party) indicates the agency responsible for the intervention or interpretation, for example an editor or transcriber.`,
          eventType: 'attributeName',
          fullName: 'responsible party',
          name: 'resp',
          ns: '',
          type: 'attribute',
        } satisfies NodeDetail);
      });

      test('Invalid xpath', async () => {
        expect.assertions(1);
        const attributes = await Validator.getAttributesForTagAt('/TEI/text/body/divv/p', 1);
        expect(attributes).toBeUndefined();
      });
    });

    describe('getTagAttributeAt', () => {
      test('rend at /TEI/text/body/div/p', async () => {
        expect.assertions(1);
        const attribute = await Validator.getTagAttributeAt('rend', '/TEI/text/body/div/p');

        expect(attribute).toEqual({
          documentation: `(rendition) indicates how the element in question was rendered or presented in the source text.`,
          eventType: 'attributeName',
          fullName: 'rendition',
          name: 'rend',
          ns: '',
          type: 'attribute',
        } satisfies NodeDetail);
      });

      test('Invalid xpath', async () => {
        expect.assertions(1);
        const attribute = await Validator.getTagAttributeAt('rend', '/TEI/text/body/divv/p');
        expect(attribute).toBeUndefined();
      });

      test('Attribute is not a children ', async () => {
        expect.assertions(1);
        const attribute = await Validator.getTagAttributeAt('mount', '/TEI/text/body/div/p');
        expect(attribute).toBeUndefined();
      });
    });

    describe('getValuesForTagAttributeAt', () => {
      test.skip('getValuesForTagAttributeAt', async () => {
        expect.assertions(2);
        const attributeValues = await Validator.getValuesForTagAttributeAt(
          '/TEI/text/body/div/closer/signed/persName/persName/@cert',
        );
        expect(attributeValues).toHaveLength(4);
        expect(attributeValues).toContainEqual({
          documentation: undefined,
          eventType: 'attributeValue',
          fullName: undefined,
          name: 'high',
          type: 'attributeValue',
          value: 'high',
        } satisfies NodeDetail);
      });

      test('Invalid xpath', async () => {
        expect.assertions(1);
        const attributeValues = await Validator.getValuesForTagAttributeAt(
          '/TEI/text/body/divv/closer/signed/persName/persName/@cert',
        );
        expect(attributeValues).toBeUndefined();
      });
    });
  });

  describe('Possible Nodes', () => {
    test('At', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: '/TEI/text[1]/body[1]/div[1]/P[1]',
          index: 0,
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('invalid', expect.any(Boolean));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('AROUND selection SPAN', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div/p[2]',
          index: 2,
          selection: {
            endContainerIndex: 2,
            endOffset: 35,
            startContainerIndex: 2,
            startOffset: 31,
            type: 'span',
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('invalid', expect.any(Boolean));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('AROUND selection SPAN ALTERNATIVE', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div/p[2]',
          index: 3,
          selection: {
            endContainerIndex: 4,
            endOffset: 35,
            startContainerIndex: 2,
            startOffset: 31,
            type: 'span',
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('invalid', expect.any(Boolean));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('BEFORE', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div',
          index: 0,
          selection: {
            containerIndex: 3,
            type: 'before',
            xpath: 'TEI/text/body/div',
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('invalid', expect.any(Boolean));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('AFTER', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div',
          index: 5,
          selection: {
            containerIndex: 5,
            type: 'after',
            xpath: 'TEI/text/body/div',
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('invalid', expect.any(Boolean));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('AROUND', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div/p',
          index: 4,
          selection: {
            type: 'around',
            xpath: 'TEI/text/body/div/p',
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('INSIDE', async () => {
      expect.hasAssertions();
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div/p',
          index: 0,
          selection: {
            type: 'inside',
            xpath: 'TEI/text/body/div/p',
            endContainerIndex: 2,
            startContainerIndex: 0,
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });

    test('for CHANGE at', async () => {
      const results = await Validator.getPossibleNodesAt(
        {
          xpath: 'TEI/text/body/div',
          index: 4,
          selection: {
            endContainerIndex: 16,
            skip: 'p',
            startContainerIndex: 0,
            type: 'change',
            xpath: 'TEI/text/body/div/p',
          },
        },
        { speculativeValidate: true },
      );

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });
  });

  describe('Valid Nodes', () => {
    test('At', async () => {
      expect.hasAssertions();
      const results = await Validator.getValidNodesAt({
        xpath: '/TEI/text[1]/body[1]/div[1]/P[1]',
        index: 0,
      });

      expect(results).toHaveProperty('nodes', expect.any(Array));
      expect(results?.nodes.length).toBeGreaterThan(0);
      results?.nodes.forEach((tag) => {
        expect(tag).toHaveProperty('eventType', expect.any(String));
        expect(tag).toHaveProperty('invalid', expect.any(Boolean));
        expect(tag).toHaveProperty('name', expect.any(String));
        expect(tag).toHaveProperty('type', expect.any(String));
      });
    });
  });

  test('stop Validator', async () => {
    expect.assertions(1);
    await Validator.reset();
    expect(await Validator.hasValidator()).toBe(false);
  });

  describe('throw error', () => {
    test('getTagAt - throw error', async () => {
      expect.assertions(1);
      expect(async () => {
        await Validator.getTagAt('p', '/TEI/text/body/div', 0);
      }).rejects.toThrow();
    });

    test('getElementsForTagAt - throw error', async () => {
      expect.assertions(1);
      expect(async () => {
        await Validator.getNodesForTagAt('/TEI/text/body/div/p', 0);
      }).rejects.toThrow();
    });

    test('getAttributesForTagAt - throw error', async () => {
      expect.assertions(1);
      expect(async () => {
        await Validator.getAttributesForTagAt('/TEI/text/body/div/p', 1);
      }).rejects.toThrow();
    });

    test('getTagAttributeAt - throw error', async () => {
      expect.assertions(1);
      expect(async () => {
        await Validator.getTagAttributeAt('rend', '/TEI/text/body/div/p');
      }).rejects.toThrow();
    });

    test('getValuesForTagAttributeAt - throw error', async () => {
      expect.assertions(1);
      expect(async () => {
        await Validator.getValuesForTagAttributeAt(
          '/TEI/text/body/div/closer/signed/persName/persName/@cert',
        );
      }).rejects.toThrow();
    });

    test('getValidTagsAt - throw error', async () => {
      expect.assertions(1);
      expect(async () => {
        await Validator.getPossibleNodesAt({
          xpath: '/TEI/text[1]/body[1]/div[1]/P[1]',
          index: 0,
        });
      }).rejects.toThrow();
    });
  });

  describe('clean up', () => {
    test('clear cache', async () => {
      expect.assertions(1);

      const response = await Validator.clearCache();
      expect(response).not.toBe(Error);
    });

    test('delete db', async () => {
      expect.assertions(1);

      const response = await deleteDb();
      expect(response).not.toBe(Error);
    });
  });
});
