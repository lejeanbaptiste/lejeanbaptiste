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
  return segmentPersonNameWithPlugins(name, projectLang, (part) => autoRomanize(part, projectLang));
}

/** Romanize a new person label, using plugin split parts when Norbert (etc.) is enabled. */
export function suggestPersonRomanization(
  name: string,
  projectLang: string | null,
): string | null {
  const split = suggestPersonNameSplit(name, projectLang);
  if (split?.romanizedName) return split.romanizedName;
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
