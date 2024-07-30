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
        expect(i18next.language).toEqual(supportedLanguages['en'].code);
        await updateTranslation('fr');
        expect(i18next.language).toEqual(supportedLanguages['fr'].code);
        await updateTranslation('en');
        expect(i18next.language).toEqual(supportedLanguages['en'].code);
      });

      test('language not supported', async () => {
        expect.assertions(2);
        expect(i18next.language).toEqual(supportedLanguages['en'].code);
        //@ts-ignore
        await updateTranslation('zz');
        expect(i18next.language).not.toEqual('zz');
      });
    });
  });
});
