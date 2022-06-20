import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import { supportedLanguages } from '../src/utilities/util';
import { overmind, resetOvermind } from './mocks/overmind';

beforeAll(() => {
  resetOvermind();
});

beforeEach(() => {
  resetOvermind();
});

describe('Overmind', () => {
  describe('ui', () => {
    test('initialize', async () => {
      expect.assertions(2);
      await overmind.actions.ui.onInitializeOvermind();
      expect(overmind.state.ui.language).toEqual(supportedLanguages['en-CA']);
      expect(overmind.state.ui.darkMode).toBe(false);
    });

    describe('language', () => {
      test('change language', () => {
        expect.assertions(2);
        expect(overmind.state.ui.language).toEqual(supportedLanguages['en-CA']);
        overmind.actions.ui.updateTranslation('fr-CA');
        expect(overmind.state.ui.language).toEqual(supportedLanguages['fr-CA']);
      });
      test('language not supported', () => {
        expect.assertions(2);
        expect(overmind.state.ui.language).toEqual(supportedLanguages['en-CA']);
        overmind.actions.ui.updateTranslation('pt-BR');
        expect(overmind.state.ui.language).not.toEqual(supportedLanguages['pt-BR']);
      });
    });
  });

  describe('local', () => {
    test('Set Resource', () => {
      expect.assertions(2);
      overmind.actions.local.setResource({ content: 'test' });
      expect(overmind.state.common.source).toEqual('local');
      expect(overmind.state.common.resource).toEqual({ content: 'test' });
    });

    test('Failed Upload File', async () => {
      const blob = new Blob([''], { type: 'text/html' });
      const fakeF = <File>blob;

      const uploadFile = await overmind.actions.local.uploadFile(fakeF).catch(() => null);
      expect(uploadFile).toEqual(null);
    });
  });
});
