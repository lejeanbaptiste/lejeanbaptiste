import { describe, expect, test } from '@jest/globals';
import '@testing-library/jest-dom';
import i18next from '../src/i18n';
import { log, logEnabledFor, supportedLanguages, updateTranslation } from '../src/utilities';

describe('General', () => {
  describe('log', () => {
    test('production', async () => {
      expect.assertions(2);

      log.setLevel('SILENT');
      expect(logEnabledFor('INFO')).toBeFalsy();

      log.setLevel('TRACE');
      expect(logEnabledFor('INFO')).toBeTruthy();
    });
  });

  describe('ui', () => {
    describe('language', () => {
      test('change language', async () => {
        expect.assertions(3);
        expect(i18next.language).toEqual(supportedLanguages['en-CA'].code);
        await updateTranslation('fr-CA');
        expect(i18next.language).toEqual(supportedLanguages['fr-CA'].code);
        await updateTranslation('en-CA');
        expect(i18next.language).toEqual(supportedLanguages['en-CA'].code);
      });

      test('language not supported', async () => {
        expect.assertions(2);
        expect(i18next.language).toEqual(supportedLanguages['en-CA'].code);
        //@ts-ignore
        await updateTranslation('pt-BR');
        expect(i18next.language).not.toEqual('pt-BR');
      });
    });
  });
});
