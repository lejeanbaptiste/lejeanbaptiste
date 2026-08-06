import { createEntitiesScaffold } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { isDesktop } from '@src/types/desktop';

/**
 * Ensure the app-level central entity database folder exists, and that it
 * actually contains an entity database. getEntityDbFolder (projectPrefs.ts)
 * only auto-creates the *directory* the first time it runs — unlike the
 * manual "choose a folder" flow (useCommonsUiBridge's pickEntityDbFolder),
 * it never scaffolds entities.xml/entities.sqlite inside it. Left alone, a
 * brand-new install's default folder would stay empty until something else
 * scaffolds it. createEntityDatabase is a no-op if entities.xml already
 * exists, so this is safe to call on splash, bridge load, and every project
 * open — not just the very first.
 */
export const ensureEntityDbFolder = async (): Promise<boolean> => {
  if (!isDesktop() || !window.electronAPI) return true;

  const folder = await window.electronAPI.getEntityDbFolder?.();
  if (!folder) return true;

  const hasEntitiesXml = await window.electronAPI.pathExists?.(`${folder}/entities.xml`);
  if (!hasEntitiesXml) {
    try {
      await window.electronAPI.createEntityDatabase?.(folder, createEntitiesScaffold());
    } catch (error) {
      console.error('[onboarding] Failed to scaffold default entity database:', error);
    }
  }

  return true;
};
