import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';

type LocaleResource = Record<string, unknown>;

const localeResources: Record<string, LocaleResource> = { de, en, es, fr, pt };

const requiredPaths = [
  'LW.translationPane.generateTranslation',
  'LW.translationPane.copyForExport',
  'LW.translationPane.lockTranslationUnit',
  'LW.translationPane.unlockTranslationUnit',
  'LW.translationPane.formatting',
  'LW.translationPane.linkDialogTitle',
  'LW.translationPane.citationStyleDialogTitle',
  'LW.translationPane.noUnit',
  'LW.translationPane.startTypingPlaceholder',
  'LW.translationPane.waitingForZoteroCitation',
  'LW.translationPane.zoteroCitationFailed',
  'LW.translationPane.footnotePlaceholder',
  'LW.translationPane.removeFootnote',
  'LW.translationPane.unindexedUnitMessage',
  'LW.translationPane.selectUnitMessage',
];

const getValue = (resource: LocaleResource, path: string): unknown => {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, resource);
};

describe('translation pane locale keys', () => {
  test.each(Object.entries(localeResources))(
    'keeps translation pane strings in %s locale',
    (_locale, resource) => {
      for (const path of requiredPaths) {
        const value = getValue(resource, path);
        expect(value).toEqual(expect.any(String));
        expect((value as string).trim()).not.toBe('');
      }
    },
  );
});
