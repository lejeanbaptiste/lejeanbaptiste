import { setFamilyName, setGivenName } from '../autoTagging/entityOps';
import { autoRomanize } from '../utilities/romanize';
import {
  segmentPersonNameWithPlugins,
  type PluginPersonNameSegmentResult,
} from './personNameSegmenters';

export function suggestPersonNameSplit(
  name: string,
  projectLang: string | null,
): PluginPersonNameSegmentResult | null {
  // Each part (surname, given name) romanizes as one concatenated word —
  // "Chunfeng", not "Chun Feng" — regardless of how the segmenter itself
  // joins the two parts back together for its own `romanizedName`.
  return segmentPersonNameWithPlugins(name, projectLang, (part) =>
    autoRomanize(part, projectLang, { concatenate: true }),
  );
}

/** Romanize a new person label, using plugin split parts when Norbert (etc.) is enabled. */
export function suggestPersonRomanization(
  name: string,
  projectLang: string | null,
): string | null {
  const split = suggestPersonNameSplit(name, projectLang);
  if (split) {
    const family = autoRomanize(split.familyName, projectLang, { concatenate: true });
    const given = autoRomanize(split.givenName, projectLang, { concatenate: true });
    if (family && given) return `${family} ${given}`;
    if (split.romanizedName) return split.romanizedName;
  }
  return autoRomanize(name, projectLang);
}

/** After minting a person entity, apply plugin family/given split to entities.xml notes. */
export function applyPersonNameSplitToEntity(
  entitiesDoc: Document,
  entityId: string,
  name: string,
  projectLang: string | null,
): PluginPersonNameSegmentResult | null {
  const split = suggestPersonNameSplit(name, projectLang);
  if (!split) return null;
  setFamilyName(entitiesDoc, entityId, split.familyName);
  setGivenName(entitiesDoc, entityId, split.givenName);
  return split;
}
