/**
 * User taste exclusions for auto-tagging: nesting bans and surface+tag bans.
 * Nesting lines look like `//persName//title` (block <title> inside <persName>).
 * Surfaces are exact string matches per TEI tag (e.g. placeName → 將軍).
 */

import type { UserRule } from './apply';
import type { Suggestion } from './types';

export const EXCLUSION_SURFACE_TAGS = [
  'persName',
  'placeName',
  'geogName',
  'orgName',
  'title',
  'roleName',
] as const;

export type ExclusionSurfaceTag = (typeof EXCLUSION_SURFACE_TAGS)[number];

export interface AutoTaggingExclusions {
  /** Raw nesting lines (one per line), e.g. `//persName//title`. */
  nestingPaths: string[];
  /** Exact surfaces barred for each tag. */
  surfacesByTag: Partial<Record<ExclusionSurfaceTag, string[]>>;
}

export const emptyExclusions = (): AutoTaggingExclusions => ({
  nestingPaths: [],
  surfacesByTag: {},
});

const STORAGE_KEY = 'grognard:autoTaggingExclusions';

/** Parse `//ancestor//child` (optional whitespace) into a UserRule. */
export function parseNestingPath(line: string): UserRule | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^\/\/\s*([A-Za-z][\w.-]*)\s*\/\/\s*([A-Za-z][\w.-]*)\s*$/);
  if (!match) return null;
  return { notInside: match[1]!, tag: match[2]! };
}

export function nestingPathsToUserRules(paths: string[]): UserRule[] {
  const rules: UserRule[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    const rule = parseNestingPath(path);
    if (!rule) continue;
    const key = `${rule.tag}\t${rule.notInside}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(rule);
  }
  return rules;
}

export function userRulesToNestingPaths(rules: UserRule[]): string[] {
  return rules.map((rule) => `//${rule.notInside}//${rule.tag}`);
}

/** Lines of text → trimmed non-empty unique strings. */
export function linesToSurfaces(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function surfacesToLines(surfaces: string[] | undefined): string {
  return (surfaces ?? []).join('\n');
}

export function exclusionsHaveContent(exclusions: AutoTaggingExclusions): boolean {
  if (exclusions.nestingPaths.some((line) => line.trim() && !line.trim().startsWith('#'))) {
    return true;
  }
  return Object.values(exclusions.surfacesByTag).some((list) => (list?.length ?? 0) > 0);
}

export function filterSuggestionsByExclusions(
  suggestions: Suggestion[],
  exclusions: AutoTaggingExclusions,
): Suggestion[] {
  const blocked = new Map<string, Set<string>>();
  for (const [tag, surfaces] of Object.entries(exclusions.surfacesByTag)) {
    if (!surfaces?.length) continue;
    blocked.set(tag, new Set(surfaces));
  }
  if (blocked.size === 0) return suggestions;
  return suggestions.filter((suggestion) => {
    const set = blocked.get(suggestion.tag);
    if (!set) return true;
    return !set.has(suggestion.anchor.surface);
  });
}

function storageKeyForProject(): string {
  const projectPath = window.__leafWriterProject?.getProjectFilePath?.();
  return `${STORAGE_KEY}:${projectPath || 'default'}`;
}

export function readPersistedExclusions(): AutoTaggingExclusions {
  try {
    const raw = localStorage.getItem(storageKeyForProject());
    if (!raw) return emptyExclusions();
    const parsed = JSON.parse(raw) as Partial<AutoTaggingExclusions>;
    const nestingPaths = Array.isArray(parsed.nestingPaths)
      ? parsed.nestingPaths.filter((line): line is string => typeof line === 'string')
      : [];
    const surfacesByTag: AutoTaggingExclusions['surfacesByTag'] = {};
    if (parsed.surfacesByTag && typeof parsed.surfacesByTag === 'object') {
      for (const tag of EXCLUSION_SURFACE_TAGS) {
        const list = parsed.surfacesByTag[tag];
        if (Array.isArray(list)) {
          surfacesByTag[tag] = list.filter(
            (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
          );
        }
      }
    }
    return { nestingPaths, surfacesByTag };
  } catch {
    return emptyExclusions();
  }
}

export function persistExclusions(exclusions: AutoTaggingExclusions): void {
  try {
    localStorage.setItem(storageKeyForProject(), JSON.stringify(exclusions));
  } catch {
    // Decorative preference — ignore quota / private mode failures.
  }
}

export function currentUserRules(): UserRule[] {
  return nestingPathsToUserRules(readPersistedExclusions().nestingPaths);
}
