import { joinPath } from './pathJoin';

export type EntityStoreMode = 'central' | 'project';

export interface EntityStorePaths {
  mode: EntityStoreMode;
  entitiesPath: string;
  projectLjbDir: string;
  projectRoot: string;
  centralFolder: string | null;
}

export interface EntityStoreResolveInput {
  projectRoot: string;
  entityStore?: EntityStoreMode;
  centralFolder?: string | null;
}

/** Resolve entity database and project hidden infra paths. */
export function resolveEntityStorePaths(input: EntityStoreResolveInput): EntityStorePaths {
  const mode: EntityStoreMode = input.entityStore === 'central' ? 'central' : 'project';
  const projectRoot = input.projectRoot.replace(/[/\\]+$/, '');
  const projectLjbDir = joinPath(projectRoot, '.ljb');

  if (mode === 'project') {
    return {
      mode,
      entitiesPath: joinPath(projectRoot, 'entities.xml'),
      projectLjbDir,
      projectRoot,
      centralFolder: null,
    };
  }

  const centralFolder = input.centralFolder?.trim() || null;
  if (!centralFolder) {
    throw new Error('Central entity database folder is not configured.');
  }

  return {
    mode,
    entitiesPath: joinPath(centralFolder, 'entities.xml'),
    projectLjbDir,
    projectRoot,
    centralFolder,
  };
}
