import {
  centralEntityStoreFromDesktop,
  entityStoreFromDesktop,
} from '../../autoTagging/entityStore';
import { summaryFromSqlitePanel, type EntitySummary, type SqlitePanelLike } from './entitySummary';

export interface SourceUnitEntityHit {
  key: string;
  kind: string;
  surface: string;
}

const TAG_TO_KIND: Record<string, string> = {
  persName: 'person',
  placeName: 'place',
  orgName: 'org',
  title: 'work',
  bibl: 'work',
  roleName: 'office',
};

/**
 * Collect unique keyed entity mentions inside the source alignment unit
 * currently selected for translation (live TinyMCE DOM).
 */
export const collectSourceUnitEntities = (
  alignmentUnit: 'div' | 'p',
  unitId: string,
): SourceUnitEntityHit[] => {
  const writer = window.writer as
    | {
        editor?: { getBody?: () => HTMLElement | null };
        schemaManager?: { getIdName?: () => string | null };
        tagger?: { getAttributesForTag?: (el: Element) => Record<string, string> };
      }
    | undefined;
  const body = writer?.editor?.getBody?.();
  if (!body) return [];

  const schemaId = writer?.schemaManager?.getIdName?.() ?? 'xml:id';
  const units = Array.from(body.querySelectorAll(`[_tag="${alignmentUnit}"]`));
  const unitEl = units.find((el) => {
    const attrs = writer?.tagger?.getAttributesForTag?.(el) ?? {};
    const id = attrs[schemaId] ?? attrs.id;
    return id === unitId;
  });
  if (!unitEl) return [];

  const seen = new Set<string>();
  const hits: SourceUnitEntityHit[] = [];
  for (const [tag, kind] of Object.entries(TAG_TO_KIND)) {
    for (const el of Array.from(unitEl.querySelectorAll(`[_tag="${tag}"]`))) {
      const attrs = writer?.tagger?.getAttributesForTag?.(el) ?? {};
      const key = attrs.key?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      hits.push({
        key,
        kind,
        surface: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return hits;
};

const panelToSummary = (raw: unknown): EntitySummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  const panel = raw as SqlitePanelLike;
  if (typeof panel.id !== 'string' || !Array.isArray(panel.names)) return null;
  return summaryFromSqlitePanel(panel);
};

/** Project entity DB first, then central — same resolution order as the Word plugin API. */
export const fetchEntitySummary = async (entityId: string): Promise<EntitySummary | null> => {
  const project = entityStoreFromDesktop();
  if (project && (await project.hasSqliteDatabase())) {
    const fromProject = panelToSummary(await project.sqliteEntitySummary(entityId));
    if (fromProject) return fromProject;
  }

  const projectMeta = (window as unknown as { __ljbLspProject?: { entityDbFolder?: string | null } })
    .__ljbLspProject;
  const central = centralEntityStoreFromDesktop(projectMeta?.entityDbFolder ?? null);
  if (central && (await central.hasSqliteDatabase())) {
    return panelToSummary(await central.sqliteEntitySummary(entityId));
  }
  return null;
};

export interface EntityPickerSearchHit {
  id: string;
  kind: string;
  label: string;
  description?: string;
  source: 'project' | 'central';
}

const PICKER_KINDS = ['person', 'place', 'org', 'work', 'office'] as const;

/**
 * Search project (then central) entity databases for the person-button picker.
 * Autocomplete stays unit-scoped; this is for footnotes / parentheticals.
 */
export const searchEntitiesForPicker = async (
  query: string,
  limitPerKind = 6,
): Promise<EntityPickerSearchHit[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const collect = async (
    store: ReturnType<typeof entityStoreFromDesktop>,
    source: 'project' | 'central',
  ): Promise<EntityPickerSearchHit[]> => {
    if (!store || !(await store.hasSqliteDatabase())) return [];
    const batches = await Promise.all(
      PICKER_KINDS.map(async (kind) => {
        const hits = await store.sqliteSearchNames(kind, trimmed, limitPerKind);
        return (hits ?? []).map((hit) => ({
          id: hit.id,
          kind,
          label: hit.label,
          description: hit.description,
          source,
        }));
      }),
    );
    return batches.flat();
  };

  const projectHits = await collect(entityStoreFromDesktop(), 'project');
  const seen = new Set(projectHits.map((hit) => hit.id));

  const projectMeta = (window as unknown as { __ljbLspProject?: { entityDbFolder?: string | null } })
    .__ljbLspProject;
  const centralHits = (
    await collect(centralEntityStoreFromDesktop(projectMeta?.entityDbFolder ?? null), 'central')
  ).filter((hit) => !seen.has(hit.id));

  return [...projectHits, ...centralHits].slice(0, 40);
};
