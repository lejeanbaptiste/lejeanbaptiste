/**
 * Registry of project roots sharing an entity database. Lives as
 * `entity-projects.json` beside `entities.xml`; every project that opens the
 * database checks itself in, so merge/delete key propagation can *eagerly*
 * rewrite the trees it can see right now.
 *
 * The registry is an **optimization, not the correctness backbone** — that is
 * the durable order log (`entityOrders.ts`), which lets any tree converge on its
 * next open regardless of whether it was registered or reachable at merge time.
 * So check-in is now **non-destructive**: it never deletes another entry just
 * because that path can't be seen from the current machine. Doing so was the
 * roaming bug in `entity-registry-merges-and-splits.md` (Stories A–F) — opening
 * on machine B dropped machine A's checkout, and a later merge on A silently
 * missed B. We still filter to existing paths at *use* time (`resolveProjectRoots`)
 * because we can only walk what is actually present, but we no longer throw the
 * record away.
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
 * Check a project root into the registry, non-destructively: keep every existing
 * entry (including paths not visible from this machine — they belong to other
 * checkouts) and append this root if it isn't already recorded. Returns the
 * registered roots after the update.
 */
export async function registerProject(
  api: EntityFileApi,
  entitiesPath: string,
  projectRoot: string,
): Promise<string[]> {
  const existing = await readProjectRegistry(api, entitiesPath);

  const already = existing.some((root) => normalizePath(root) === normalizePath(projectRoot));
  const next = already ? existing : [...existing, projectRoot];

  if (!already) {
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
