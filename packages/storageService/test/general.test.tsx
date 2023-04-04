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
      test('change language', () => {
        expect.assertions(3);
        expect(i18next.language).toEqual(supportedLanguages['en-CA'].code);
        updateTranslation('fr-CA');
        expect(i18next.language).toEqual(supportedLanguages['fr-CA'].code);
        updateTranslation('en-CA');
        expect(i18next.language).toEqual(supportedLanguages['en-CA'].code);
      });

      test('language not supported', () => {
        expect.assertions(2);
        expect(i18next.language).toEqual(supportedLanguages['en-CA'].code);
        //@ts-ignore
        updateTranslation('pt-BR');
        //@ts-ignore
        expect(i18next.language).not.toEqual('pt-BR');
      });
    });
  });
});
