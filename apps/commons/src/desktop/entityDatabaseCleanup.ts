import { ENTITIES_FILE_NAME, pathsMatch } from './infrastructurePaths';
import { joinProjectPath } from './projectFile';

/** Remove a stale project-local entities.xml when the project uses a central database elsewhere. */
export const removeOrphanProjectEntitiesFile = async (
  projectRoot: string,
  centralFolder?: string | null,
): Promise<void> => {
  if (!window.electronAPI?.pathExists || !window.electronAPI.deletePath) return;

  const normalizedCentral = centralFolder?.trim();
  if (!normalizedCentral) return;
  if (pathsMatch(normalizedCentral, projectRoot)) return;

  const orphanPath = joinProjectPath(projectRoot, ENTITIES_FILE_NAME);
  try {
    if (await window.electronAPI.pathExists(orphanPath)) {
      await window.electronAPI.deletePath(orphanPath);
    }
  } catch {
    // Best-effort cleanup only.
  }
};
