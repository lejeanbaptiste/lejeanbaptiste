import i18n from '../i18n';
import { EntityType } from '../types';

export const urlRegex = new RegExp(
  /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/,
  'i',
);

export const isValidHttpURL = (value: string) => {
  const res = value.match(/^http(s)?:\/\/[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,6}(\/\S*)?$/);
  return res !== null;
};

/**
 * Take a string, capitalize the first letter, and lowercase the rest.
 * @param {string} w - string - the string to capitalize
 */
export const capitalizeString = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export const getEntityTypeLabelLocalized = (entity: EntityType) => {
  return i18n.t(`LW.entity.${entity}`);
};

export const slugify = (string: string, separator: string = '-') => {
  let text = string.toLowerCase().trim();

  const sets = [
    { from: '[ÀÁÂÃÄÅÆĀĂĄẠẢẤẦẨẪẬẮẰẲẴẶ]', to: 'a' },
    { from: '[ÇĆĈČ]', to: 'c' },
    { from: '[ÐĎĐÞ]', to: 'd' },
    { from: '[ÈÉÊËĒĔĖĘĚẸẺẼẾỀỂỄỆ]', to: 'e' },
    { from: '[ĜĞĢǴ]', to: 'g' },
    { from: '[ĤḦ]', to: 'h' },
    { from: '[ÌÍÎÏĨĪĮİỈỊ]', to: 'i' },
    { from: '[Ĵ]', to: 'j' },
    { from: '[Ĳ]', to: 'ij' },
    { from: '[Ķ]', to: 'k' },
    { from: '[ĹĻĽŁ]', to: 'l' },
    { from: '[Ḿ]', to: 'm' },
    { from: '[ÑŃŅŇ]', to: 'n' },
    { from: '[ÒÓÔÕÖØŌŎŐỌỎỐỒỔỖỘỚỜỞỠỢǪǬƠ]', to: 'o' },
    { from: '[Œ]', to: 'oe' },
    { from: '[ṕ]', to: 'p' },
    { from: '[ŔŖŘ]', to: 'r' },
    { from: '[ßŚŜŞŠ]', to: 's' },
    { from: '[ŢŤ]', to: 't' },
    { from: '[ÙÚÛÜŨŪŬŮŰŲỤỦỨỪỬỮỰƯ]', to: 'u' },
    { from: '[ẂŴẀẄ]', to: 'w' },
    { from: '[ẍ]', to: 'x' },
    { from: '[ÝŶŸỲỴỶỸ]', to: 'y' },
    { from: '[ŹŻŽ]', to: 'z' },
    { from: `[·/_,:;']`, to: '-' },
  ];

  const replaceChar = (set: { from: string; to: string }) => {
    text = text.replace(new RegExp(set.from, 'gi'), set.to);
  };

  sets.forEach(replaceChar);

  text = text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (typeof separator !== 'undefined' && separator !== '-') {
    text = text.replace(/-/g, separator);
  }

  return text;
};
