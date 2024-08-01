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
    describe('locale', () => {
      test('change locale', async () => {
        expect.assertions(3);
        expect(i18n.language).toEqual('en');
        await updateLocale('fr');
        expect(i18n.language).toEqual('fr');
        await updateLocale('en');
        expect(i18n.language).toEqual('en');
      });

      test('locale not supported', async () => {
        expect.assertions(2);
        expect(i18n.language).toEqual('en');
        //@ts-ignore
        await updateLocale('zz');
        expect(i18n.language).not.toEqual('zz');
      });
    });
  });
});
