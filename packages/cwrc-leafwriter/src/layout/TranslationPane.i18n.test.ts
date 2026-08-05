import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';

type LocaleResource = Record<string, unknown>;

const localeResources: Record<string, LocaleResource> = { de, en, es, fr, pt };

const requiredPaths = [
  'LW.translationPane.generateTranslation',
  'LW.translationPane.aiSkippedExisting',
  'LW.translationPane.copyForExport',
  'LW.translationPane.formatting',
  'LW.translationPane.insertFootnote',
  'LW.translationPane.zoteroMenu.title',
  'LW.translationPane.zoteroMenu.refresh',
  'LW.translationPane.zoteroMenu.preferences',
  'LW.translationPane.zoteroMenu.refreshing',
  'LW.translationPane.zoteroMenu.unavailable',
  'LW.translationPane.formatItems.zoteroCitation',
  'LW.translationPane.linkDialogTitle',
  'LW.translationPane.citationStyleDialogTitle',
  'LW.translationPane.emptyUnitPreview',
  'LW.translationPane.startTypingPlaceholder',
  'LW.translationPane.waitingForZoteroCitation',
  'LW.translationPane.zoteroCitationFailed',
  'LW.translationPane.footnotePlaceholder',
  'LW.translationPane.removeFootnote',
  'LW.translationPane.unindexedUnitMessage',
  'LW.translationPane.selectUnitMessage',
  'LW.translationPane.insertEntity',
  'LW.translationPane.noSourceEntities',
  'LW.translationPane.entityNeedUnit',
  'LW.translationPane.entityNotFound',
  'LW.translationPane.entityFormat.title',
  'LW.translationPane.entityFormat.family',
  'LW.translationPane.entityFormat.given',
  'LW.translationPane.entityFormat.chinese',
  'LW.translationPane.entityFormat.dates',
  'LW.translationPane.entityFormat.brackets',
  'LW.translationPane.entityFormat.chipHint',
  'LW.translationPane.entityFormat.possessive',
  'LW.translationPane.entityFormat.possessiveGerman',
  'LW.translationPane.entityFormat.preview',
  'LW.translationPane.entityFormat.reset',
  'LW.translationPane.entityFormat.done',
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
