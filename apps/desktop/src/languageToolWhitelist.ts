import path from 'path';
import {
  collectLanguageToolWhitelist,
  filterLanguageToolMatchesByWhitelist,
  isLatinScriptName,
  type LanguageToolMatch,
} from './languageTool';
import { listEntitySqlitePanelSummaries } from './entityDbSqlite/readService';
import { getEntityDbFolder } from './projectPrefs';

const ENTITY_KINDS = ['person', 'place', 'work'] as const;

/**
 * Latin-script / romanized names from the central entity DB for LanguageTool
 * post-filtering (proper nouns should not be flagged as misspellings).
 */
export const loadLanguageToolEntityWhitelist = async (
  extraDatabasePaths: string[] = [],
): Promise<Set<string>> => {
  const paths = new Set<string>();
  try {
    const central = await getEntityDbFolder();
    if (central) paths.add(path.join(central, 'entities.sqlite'));
  } catch {
    // Central DB optional.
  }
  for (const candidate of extraDatabasePaths) {
    if (typeof candidate === 'string' && candidate.trim()) paths.add(candidate.trim());
  }

  const nameRows: { text?: string | null; language?: string | null }[] = [];

  for (const databasePath of paths) {
    for (const kind of ENTITY_KINDS) {
      try {
        const summaries = await listEntitySqlitePanelSummaries({ databasePath, kind });
        if (!summaries) continue;
        for (const summary of summaries) {
          for (const name of summary.names ?? []) {
            nameRows.push({ text: name.text, language: name.language });
          }
          if (summary.familyName && isLatinScriptName(summary.familyName)) {
            nameRows.push({ text: summary.familyName, language: 'und-Latn' });
          }
          if (summary.givenName && isLatinScriptName(summary.givenName)) {
            nameRows.push({ text: summary.givenName, language: 'und-Latn' });
          }
        }
      } catch {
        // Missing or unreadable DB — skip.
      }
    }
  }

  return collectLanguageToolWhitelist(nameRows);
};

export const applyWhitelistToMatches = (
  text: string,
  matches: LanguageToolMatch[],
  whitelist: Set<string>,
): LanguageToolMatch[] => filterLanguageToolMatchesByWhitelist(text, matches, whitelist);
