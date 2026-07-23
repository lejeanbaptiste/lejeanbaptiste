import {
  containsAnyKey,
  rewriteMentionKeys,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/rewriteMentionKeys';
import type { EntityStore } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { pathsMatch } from '../infrastructurePaths';
import { collectXmlFiles } from '../xpath/collectXmlFiles';

/**
 * Propagate an entity key remap (merge: old → new, delete: old → null) across
 * every XML document of every project registered against the entity database.
 * Files are rewritten as strings so formatting is preserved; the entity
 * database itself is skipped.
 */

export interface KeyRemapSummary {
  projectRoots: string[];
  filesScanned: number;
  filesChanged: number;
  keysUpdated: number;
  /** Per-file failure messages; a failed file never blocks the rest. */
  errors: string[];
}

export interface KeyRemapFileOps {
  listXmlFiles: (projectRoot: string) => Promise<string[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
}

const desktopFileOps = (): KeyRemapFileOps => ({
  listXmlFiles: (projectRoot) => collectXmlFiles(projectRoot),
  readFile: (filePath) => window.electronAPI!.readFile(filePath),
  writeFile: (filePath, content) => window.electronAPI!.writeFile(filePath, content),
});

export async function applyKeyRemapToRoots(
  roots: string[],
  entitiesPath: string,
  remap: Record<string, string | null>,
  ops: KeyRemapFileOps,
): Promise<KeyRemapSummary> {
  const summary: KeyRemapSummary = {
    projectRoots: roots,
    filesScanned: 0,
    filesChanged: 0,
    keysUpdated: 0,
    errors: [],
  };
  const keys = Object.keys(remap);
  if (keys.length === 0) return summary;

  const visited = new Set<string>();
  for (const root of roots) {
    let files: string[] = [];
    try {
      files = await ops.listXmlFiles(root);
    } catch (error) {
      summary.errors.push(`${root}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const filePath of files) {
      const normalized = filePath.replace(/\\/g, '/').toLowerCase();
      if (visited.has(normalized)) continue;
      visited.add(normalized);
      if (pathsMatch(filePath, entitiesPath)) continue;

      try {
        summary.filesScanned += 1;
        const xml = await ops.readFile(filePath);
        if (!containsAnyKey(xml, keys)) continue;
        const result = rewriteMentionKeys(xml, remap);
        if (!result.changed) continue;
        await ops.writeFile(filePath, result.xml);
        summary.filesChanged += 1;
        summary.keysUpdated += result.count;
      } catch (error) {
        summary.errors.push(
          `${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return summary;
}

/** Desktop entry point: resolve the registered roots from the store and apply. */
export async function applyKeyRemapAcrossProjects(
  store: EntityStore,
  remap: Record<string, string | null>,
): Promise<KeyRemapSummary> {
  const roots = await store.registryProjectRoots();
  // Reads/writes are normally restricted to the one currently-open project;
  // this operation deliberately touches every other project registered
  // against the shared entity database too, so those roots need explicit
  // one-time approval from the main process first.
  await window.electronAPI?.approveEntityRegistryRoots?.(roots);
  return applyKeyRemapToRoots(roots, store.entitiesPath, remap, desktopFileOps());
}
