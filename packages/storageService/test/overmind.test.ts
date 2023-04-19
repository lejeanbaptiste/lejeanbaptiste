import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import i18next from 'i18next';
import { supportedLanguages } from '../src/utilities';
import { overmind, resetOvermind } from './mocks/overmind';

beforeAll(() => {
  resetOvermind();
});

beforeEach(() => {
  resetOvermind();
});

describe('Overmind', () => {
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
