import leafWriterI18n from '../../../../packages/cwrc-leafwriter/src/i18n';
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';

const COMMONS_LOCALES = { en, fr, de, es, pt } as const;

let registered = false;

/** Merge commons (LWC) strings into LEAF-Writer's i18n for desktop-only settings UI. */
export const registerLeafWriterCommonsI18n = () => {
  if (registered) return;
  registered = true;

  for (const [lng, bundle] of Object.entries(COMMONS_LOCALES)) {
    if (bundle.LWC) {
      leafWriterI18n.addResourceBundle(lng, 'LWC', bundle.LWC, true, true);
    }
  }
};
