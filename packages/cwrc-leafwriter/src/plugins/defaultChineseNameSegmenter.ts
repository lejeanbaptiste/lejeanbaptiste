import { isChineseLanguageCode } from '../utilities/languageCodes';
import type {
  PluginPersonNameSegmentInput,
  PluginPersonNameSegmentResult,
} from './personNameSegmenters';

/**
 * Common 2-character (compound) Chinese surnames, checked before falling
 * back to a 1-character surname. Far from exhaustive — historical figures
 * with rarer compound surnames may still split wrong — but covers the
 * surnames someone is actually likely to tag.
 */
const COMPOUND_SURNAMES = [
  '歐陽',
  '欧阳',
  '司馬',
  '司马',
  '上官',
  '諸葛',
  '诸葛',
  '夏侯',
  '皇甫',
  '尉遲',
  '尉迟',
  '公孫',
  '公孙',
  '長孫',
  '长孙',
  '宇文',
  '呼延',
  '南宮',
  '南宫',
  '東方',
  '东方',
  '獨孤',
  '独孤',
  '軒轅',
  '轩辕',
  '令狐',
  '拓跋',
  '慕容',
];

/**
 * Last-resort Chinese family/given split, used when no registered plugin
 * (e.g. Norbert) recognizes the name — including when a plugin is active but
 * its own data lacks an entry for this particular person. Assumes the common
 * pattern of a 1- (rarely 2-) character surname followed by a 1-2 character
 * given name; historically atypical names may split wrong, which is why this
 * only runs after every registered plugin segmenter has had a chance.
 */
export function defaultChineseNameSegmenter(
  input: PluginPersonNameSegmentInput,
): PluginPersonNameSegmentResult | null {
  if (!isChineseLanguageCode(input.projectLang)) return null;
  const { name, romanize } = input;
  // Dump placeholders like "nan" (and any Latin) are not Chinese personal names.
  if (!/^[\u4e00-\u9fff]+$/u.test(name)) return null;
  if (name.length < 2 || name.length > 4) return null;

  const compound = COMPOUND_SURNAMES.find((surname) => name.startsWith(surname));
  const familyName = compound ?? name.slice(0, 1);
  const givenName = name.slice(familyName.length);
  if (!givenName) return null;

  const family = romanize(familyName);
  const given = romanize(givenName);
  return {
    familyName,
    givenName,
    romanizedName: family && given ? `${family} ${given}` : null,
  };
}
