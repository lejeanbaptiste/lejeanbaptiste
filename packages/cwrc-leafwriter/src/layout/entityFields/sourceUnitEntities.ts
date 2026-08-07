import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
} from '../../autoTagging/entityStore';
import { readOrMintUserStableId } from '../../autoTagging/userStableId';
import {
  summaryFromSqlitePanel,
  type EntitySummary,
  type EntityTranslationEntry,
  type SqlitePanelLike,
} from './entitySummary';

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
  officeName: 'office',
};

/** TEI tags collected / blinded for the AI translation entity pipeline. */
export const SOURCE_UNIT_ENTITY_TAGS = Object.keys(TAG_TO_KIND);

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

const elementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const namespaced =
    'getElementsByTagNameNS' in root
      ? Array.from(root.getElementsByTagNameNS(TEI_NS, localName))
      : [];
  const plain = Array.from(root.getElementsByTagName(localName));
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const el of [...namespaced, ...plain]) {
    if (!seen.has(el)) {
      seen.add(el);
      result.push(el);
    }
  }
  return result;
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

/**
 * Collect keyed entities from serialized source-unit XML (what the AI receives).
 * Prefer this for blinding + the AI payload so keys always match the XML —
 * TinyMCE collect can miss the active unit or personWrapper children.
 *
 * Also collects `name[@type='personWrapper'][@key]` — some documents key only
 * the wrapper, not the inner persName.
 */
export const collectEntitiesFromSourceUnitXml = (sourceUnitXml: string): SourceUnitEntityHit[] => {
  if (!sourceUnitXml.trim()) return [];
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  const seen = new Set<string>();
  const hits: SourceUnitEntityHit[] = [];
  const add = (key: string, kind: string, surface: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    hits.push({ key, kind, surface });
  };

  for (const [tag, kind] of Object.entries(TAG_TO_KIND)) {
    for (const el of elementsByLocalName(doc, tag)) {
      const key = el.getAttribute('key')?.trim();
      if (!key) continue;
      add(key, kind, (el.textContent ?? '').replace(/\s+/g, ' ').trim());
    }
  }
  for (const el of elementsByLocalName(doc, 'name')) {
    if (el.getAttribute('type') !== 'personWrapper') continue;
    const key = el.getAttribute('key')?.trim();
    if (!key) continue;
    add(key, 'person', (el.textContent ?? '').replace(/\s+/g, ' ').trim());
  }
  return hits;
};

const panelToSummary = (raw: unknown): EntitySummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  const panel = raw as SqlitePanelLike;
  if (typeof panel.id !== 'string' || !Array.isArray(panel.names)) return null;
  return summaryFromSqlitePanel(panel);
};

const langKey = (lang: string | null | undefined): string =>
  (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';

/**
 * Fill missing vernacular glosses (and romanization) on a project entity from
 * its linked central record. Document keys are project ids; with central sync
 * the scholar often edits the central card — LJBtero must still see those glosses.
 */
export const mergeCentralGlossesIntoSummary = (
  project: EntitySummary,
  central: EntitySummary,
): EntitySummary => {
  const byLang = new Map<string, EntityTranslationEntry>();
  for (const entry of central.translations ?? []) {
    const key = langKey(entry.lang);
    if (key && entry.text?.trim()) byLang.set(key, { lang: entry.lang, text: entry.text.trim() });
  }
  // Project wins on the same language (local override).
  for (const entry of project.translations ?? []) {
    const key = langKey(entry.lang);
    if (key && entry.text?.trim()) byLang.set(key, { lang: entry.lang, text: entry.text.trim() });
  }

  const translations = [...byLang.values()];
  const centralTranslationNames = (central.names ?? []).filter(
    (name) => name.type === 'translation' && name.text?.trim(),
  );
  const existingTexts = new Set(project.names.map((name) => name.text));
  const names = [
    ...project.names,
    ...centralTranslationNames.filter((name) => !existingTexts.has(name.text)),
  ];

  return {
    ...project,
    translations,
    names,
    romanizedName: project.romanizedName?.trim() || central.romanizedName,
    classification: project.classification?.trim() || central.classification,
    description: project.description?.trim() || central.description,
  };
};

/** Project entity DB first, then central — same resolution order as the Word plugin API. */
export const fetchEntitySummary = async (entityId: string): Promise<EntitySummary | null> => {
  const projectMeta = (window as unknown as { __ljbLspProject?: { entityDbFolder?: string | null } })
    .__ljbLspProject;
  const project = entityStoreFromDesktop();
  const central = centralEntityStoreFromDesktop(projectMeta?.entityDbFolder ?? null);

  let fromProject: EntitySummary | null = null;
  if (project && (await project.hasSqliteDatabase())) {
    fromProject = panelToSummary(await project.sqliteEntitySummary(entityId));
  }

  if (fromProject && project && central && (await central.hasSqliteDatabase())) {
    try {
      const api = desktopEntityFileApi();
      if (api) {
        const { id: userStableId } = await readOrMintUserStableId(
          api,
          central.centralFolder ?? projectMeta?.entityDbFolder ?? null,
        );
        const centralId = await project.sqliteGetCentralId(entityId, userStableId);
        if (centralId) {
          const fromCentral = panelToSummary(await central.sqliteEntitySummary(centralId));
          if (fromCentral) return mergeCentralGlossesIntoSummary(fromProject, fromCentral);
        }
      }
    } catch {
      // Fall through with the project summary alone.
    }
    return fromProject;
  }

  if (fromProject) return fromProject;

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

/**
 * Replace every keyed entity tag whose `key` is in `knownKeys` with a bare
 * `{{entity:KEY}}` text node — same blinding as dates, so the model cannot
 * paraphrase Chinese surfaces *and* keep placeholders.
 *
 * Only the outermost *keyed* entity in a nest is replaced (placeName inside a
 * keyed roleName stays inside that one placeholder). Unkeyed persName inside a
 * keyed personWrapper is blinded to the wrapper’s key. After replacement,
 * personWrapper / nobleTitle shells are unwrapped so the model sees plain
 * placeholder text rather than leftover TEI scaffolding.
 *
 * Remaining unkeyed entity tags (e.g. `<roleName><placeName>益州</placeName>刺史</roleName>`)
 * become `{{opaque:N}}` so the model cannot invent “Prefect of …”.
 */
export const replaceEntitiesWithPlaceholdersInSourceXml = (
  sourceUnitXml: string,
  knownKeys: ReadonlySet<string>,
): { xml: string; opaques: OpaqueEntityHit[] } => {
  if (!sourceUnitXml.trim()) return { xml: sourceUnitXml, opaques: [] };
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { xml: sourceUnitXml, opaques: [] };
  }

  const tagSet = new Set(SOURCE_UNIT_ENTITY_TAGS);
  /** True when an ancestor is a keyed entity tag we are also blinding. */
  const hasKeyedEntityAncestor = (el: Element): boolean => {
    let cur = el.parentElement;
    while (cur) {
      const tag = cur.localName || cur.tagName.toLowerCase();
      if (tagSet.has(tag)) {
        const key = cur.getAttribute('key')?.trim();
        if (key && knownKeys.has(key)) return true;
      }
      cur = cur.parentElement;
    }
    return false;
  };

  const toReplace: Element[] = [];
  if (knownKeys.size > 0) {
    for (const tag of SOURCE_UNIT_ENTITY_TAGS) {
      for (const el of elementsByLocalName(doc, tag)) {
        const key = el.getAttribute('key')?.trim();
        if (!key || !knownKeys.has(key)) continue;
        if (hasKeyedEntityAncestor(el)) continue;
        toReplace.push(el);
      }
    }
    // Unkeyed persName under a keyed personWrapper → same person key
    for (const wrapper of elementsByLocalName(doc, 'name')) {
      if (wrapper.getAttribute('type') !== 'personWrapper') continue;
      const wrapperKey = wrapper.getAttribute('key')?.trim();
      if (!wrapperKey || !knownKeys.has(wrapperKey)) continue;
      for (const pers of elementsByLocalName(wrapper, 'persName')) {
        const persKey = pers.getAttribute('key')?.trim();
        if (persKey && knownKeys.has(persKey)) continue; // handled above
        toReplace.push(pers);
        // Stash wrapper key for this element via temporary attribute
        pers.setAttribute('data-ljb-blind-key', wrapperKey);
      }
    }
  }

  for (const el of toReplace) {
    if (!el.parentNode) continue;
    const key =
      el.getAttribute('data-ljb-blind-key')?.trim() || el.getAttribute('key')?.trim();
    if (!key) continue;
    el.parentNode.replaceChild(doc.createTextNode(`{{entity:${key}}}`), el);
  }

  // Drop personWrapper / nobleTitle shells that only exist to group children.
  const unwrap = (el: Element) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  };
  for (const el of [...elementsByLocalName(doc, 'nobleTitle')]) unwrap(el);
  for (const el of [...elementsByLocalName(doc, 'name')]) {
    if (el.getAttribute('type') === 'personWrapper') unwrap(el);
  }

  // Opaque-blind leftover unkeyed entity tags (outermost only).
  const opaques: OpaqueEntityHit[] = [];
  const hasEntityTagAncestor = (el: Element): boolean => {
    let cur = el.parentElement;
    while (cur) {
      const tag = cur.localName || cur.tagName.toLowerCase();
      if (tagSet.has(tag)) return true;
      cur = cur.parentElement;
    }
    return false;
  };
  const opaqueTargets: Element[] = [];
  for (const tag of SOURCE_UNIT_ENTITY_TAGS) {
    for (const el of elementsByLocalName(doc, tag)) {
      if (el.getAttribute('key')?.trim()) continue;
      if (hasEntityTagAncestor(el)) continue;
      opaqueTargets.push(el);
    }
  }
  for (const el of opaqueTargets) {
    if (!el.parentNode) continue;
    const kind = TAG_TO_KIND[el.localName || el.tagName.toLowerCase()] ?? 'unknown';
    const surface = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!surface) {
      el.parentNode.removeChild(el);
      continue;
    }
    const index = opaques.length;
    opaques.push({ index, kind, surface });
    el.parentNode.replaceChild(doc.createTextNode(`{{opaque:${index}}}`), el);
  }

  const root = doc.documentElement;
  if (!root) return { xml: sourceUnitXml, opaques: [] };
  return { xml: new XMLSerializer().serializeToString(root), opaques };
};

export interface OpaqueEntityHit {
  index: number;
  kind: string;
  surface: string;
}

/** Replace `{{opaque:N}}` with a bracketed surface the scholar can clean up. */
export const substituteOpaquePlaceholders = (
  fragmentXml: string,
  opaques: ReadonlyMap<number, OpaqueEntityHit>,
): string => {
  if (!fragmentXml.includes('{{opaque:') || opaques.size === 0) return fragmentXml;
  return fragmentXml.replace(/\{\{opaque:(\d+)\}\}/g, (match, raw: string) => {
    const hit = opaques.get(Number(raw));
    if (!hit) return match;
    return `[${hit.surface}]`;
  });
};
