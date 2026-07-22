/**
 * Pre-compiled authority pack discovery under `<entityDbFolder>/authority-packs/`.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  AUTHORITY_PACKS,
  type AuthorityPackId,
  type AuthorityPackStatus,
  packPath,
  packsRoot,
} from '../../commons/src/desktop/authorityPackTypes';

export {
  AUTHORITY_PACKS_DIRNAME,
  AUTHORITY_PACKS,
  type AuthorityPackId,
  type AuthorityPackStatus,
  packPath,
  packsRoot,
} from '../../commons/src/desktop/authorityPackTypes';

export async function getAuthorityPackStatuses(
  baseFolder: string,
): Promise<AuthorityPackStatus[]> {
  return Promise.all(AUTHORITY_PACKS.filter((spec) => !spec.virtual).map(async (spec) => {
    const file = packPath(baseFolder, spec.id);
    let installed = false;
    let bytes: number | undefined;
    let entityCount: number | undefined;
    try {
      const stat = await fsp.stat(file);
      installed = stat.isFile();
      bytes = stat.size;
      const manifestPath = path.join(path.dirname(file), 'manifest.json');
      try {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as {
          files?: Record<string, { entityCount?: number }>;
        };
        entityCount = manifest.files?.[path.basename(file)]?.entityCount;
      } catch {
        // Pack files remain usable when their optional manifest is unavailable.
      }
    } catch {
      installed = false;
    }
    return {
      id: spec.id,
      label: spec.label,
      installed,
      bytes,
      entityCount,
    };
  }));
}

export async function installAuthorityPacksFrom(
  sourcePacksRoot: string,
  entityDbFolder: string,
): Promise<{ copied: AuthorityPackId[] }> {
  const destRoot = packsRoot(entityDbFolder);
  await fsp.mkdir(destRoot, { recursive: true });
  const copied: AuthorityPackId[] = [];

  for (const spec of AUTHORITY_PACKS.filter((entry) => !entry.virtual)) {
    const srcFile = path.join(sourcePacksRoot, spec.relativePath);
    const destFile = packPath(entityDbFolder, spec.id);
    await fsp.mkdir(path.dirname(destFile), { recursive: true });
    await fsp.copyFile(srcFile, destFile);
    copied.push(spec.id);

    const srcManifest = path.join(path.dirname(srcFile), 'manifest.json');
    if (fs.existsSync(srcManifest)) {
      await fsp.copyFile(
        srcManifest,
        path.join(path.dirname(destFile), 'manifest.json'),
      );
    }
  }

  return { copied };
}

export async function readAuthorityPackFile(
  entityDbFolder: string,
  packId: AuthorityPackId,
): Promise<string> {
  return fsp.readFile(packPath(entityDbFolder, packId), 'utf8');
}
