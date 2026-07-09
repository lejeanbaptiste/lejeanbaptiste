/**
 * Registry of project roots sharing an entity database. Lives as
 * `entity-projects.json` beside `entities.xml`; every project that opens the
 * database checks itself in, so merge/delete key propagation knows which
 * project trees to rewrite. Roots that no longer exist on disk are pruned on
 * read.
 */

import type { EntityFileApi } from './entityStore';

export const PROJECT_REGISTRY_FILE = 'entity-projects.json';

interface RegistryPayload {
  version: 1;
  projects: string[];
}

/** Sibling `entity-projects.json` for a given entities.xml path. */
export function registryPathFor(entitiesPath: string): string {
  return entitiesPath.replace(/[^/\\]+$/, PROJECT_REGISTRY_FILE);
}

const normalizePath = (value: string) =>
  value.split(/[/\\]+/).filter(Boolean).join('/').toLowerCase();

const parseRegistry = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as Partial<RegistryPayload>;
    if (!Array.isArray(parsed.projects)) return [];
    return parsed.projects.filter((root): root is string => typeof root === 'string' && !!root.trim());
  } catch {
    return [];
  }
};

const serializeRegistry = (projects: string[]): string =>
  JSON.stringify({ version: 1, projects } satisfies RegistryPayload, null, 2);

/** Raw registry contents (no existence filtering). */
export async function readProjectRegistry(
  api: EntityFileApi,
  entitiesPath: string,
): Promise<string[]> {
  const path = registryPathFor(entitiesPath);
  if (!(await api.pathExists(path))) return [];
  return parseRegistry(await api.readFile(path));
}

/**
 * Check a project root into the registry. Prunes roots that have vanished
 * from disk. Returns the registered roots after the update.
 */
export async function registerProject(
  api: EntityFileApi,
  entitiesPath: string,
  projectRoot: string,
): Promise<string[]> {
  const existing = await readProjectRegistry(api, entitiesPath);

  const kept: string[] = [];
  for (const root of existing) {
    if (await api.pathExists(root)) kept.push(root);
  }

  const already = kept.some((root) => normalizePath(root) === normalizePath(projectRoot));
  const next = already ? kept : [...kept, projectRoot];

  const unchanged = next.length === existing.length &&
    next.every((root, index) => root === existing[index]);
  if (!unchanged) {
    await api.writeFile(registryPathFor(entitiesPath), serializeRegistry(next));
    await api.notifyOwnWrite?.(registryPathFor(entitiesPath));
  }
  return next;
}

/**
 * Project roots to rewrite during a merge/delete: the registry filtered to
 * roots that still exist, always including the current project.
 */
export async function resolveProjectRoots(
  api: EntityFileApi,
  entitiesPath: string,
  currentProjectRoot: string,
): Promise<string[]> {
  const registered = await readProjectRegistry(api, entitiesPath);
  const roots: string[] = [];
  const seen = new Set<string>();

  for (const root of [currentProjectRoot, ...registered]) {
    const key = normalizePath(root);
    if (seen.has(key)) continue;
    seen.add(key);
    if (await api.pathExists(root)) roots.push(root);
  }
  return roots;
}
