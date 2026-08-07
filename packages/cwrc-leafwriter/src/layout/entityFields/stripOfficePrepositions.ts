/**
 * Remove English/French office paraphrases the model adds before an already-
 * blinded office/place entity placeholder (e.g. “Governor of {{entity:…}}”
 * when the office gloss is 南兗州刺史).
 */

const OFFICE_LEADS =
  'Governor|Prefect|Inspector|Magistrate|Commander|General|Minister|Duke|Prince|King|Marquis|Earl|Count|Viscount|Baron|' +
  'Gouverneur|Préfet|Inspecteur|Commandant|Général|Ministre|Duc|Prince|Roi|Marquis';

/** Strip “Governor of ” / “Préfet de ” immediately before `{{entity:…}}`. */
export const stripLeadingOfficePrepositionsFromText = (text: string): string => {
  if (!text.includes('{{entity:')) return text;
  const re = new RegExp(
    `(^|[\\s\\(\\[\\{«"“'])(?:${OFFICE_LEADS})(?:\\s+of|\\s+de|\\s+du|\\s+des|\\s+d’|\\s+d')?\\s+(?=\\{\\{entity:)`,
    'gi',
  );
  return text.replace(re, '$1');
};
