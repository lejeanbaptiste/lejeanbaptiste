import type { AuthorityCandidate } from './authority';
import { iterateAuthorityNdjson, type AuthorityPackContent } from './packLoader';
import type { WrapperFactRecord } from './wrapperFactsLog';

/**
 * A person-wrapper's found components, to disambiguate against the
 * database — never a search-string dictionary. Mirrors the old Norbert
 * project's approach: don't pre-generate every combination a person could
 * be described by; look up the specific combination that was actually
 * found in the text. `persName` is required — everything else narrows the
 * match further when present.
 */
export interface WrapperDisambiguationQuery {
  /** Top-level `<nationality>` — dynasty/court affiliation. */
  dynasty?: string;
  /** Top-level `<roleName>` — an ordinary office, distinct from a noble rank. */
  officeName?: string;
  /** The `<nobleTitle>` child's own fief and rank, if present. */
  nobleTitle?: { fief?: string; roleName?: string };
  /** Top-level `<placeName>` — the person's origin (郡望), not the title's fief. */
  originPlace?: string;
  /** The identity itself — given name, or surname+given name. */
  persName: string;
}

export interface WrapperDisambiguationIndex {
  /**
   * Person ids matching every populated field of `query`. Empty when no
   * person matches `persName` at all, or when a populated field rules out
   * every remaining candidate. The caller decides what to do with the
   * result — auto-key only when it resolves to exactly one id.
   */
  resolve(query: WrapperDisambiguationQuery): string[];
}

function addToSet(map: Map<string, Set<string>>, key: string | undefined, id: string): void {
  const trimmed = key?.trim();
  if (!trimmed) return;
  const set = map.get(trimmed);
  if (set) set.add(id);
  else map.set(trimmed, new Set([id]));
}

/** `dynasty` + fief + rank, the same shape a `<nobleTitle>` child carries. */
function titleKey(
  dynasty: string | undefined,
  fief: string | undefined,
  roleName: string | undefined,
): string {
  return [dynasty?.trim() ?? '', fief?.trim() ?? '', roleName?.trim() ?? ''].join('\0');
}

interface DisambiguationMaps {
  byPersName: Map<string, Set<string>>;
  byOrigin: Map<string, Set<string>>;
  byOffice: Map<string, Set<string>>;
  byTitle: Map<string, Set<string>>;
}

/** Shared resolver over prebuilt per-field maps — used by both the Norbert-pack and project-facts indexes. */
function indexFromMaps(maps: DisambiguationMaps): WrapperDisambiguationIndex {
  function resolve(query: WrapperDisambiguationQuery): string[] {
    const persName = query.persName.trim();
    if (!persName) return [];
    let result = maps.byPersName.get(persName);
    if (!result || result.size === 0) return [];

    const intersect = (candidates: Set<string> | undefined) => {
      if (!result || result.size === 0) return;
      if (!candidates || candidates.size === 0) {
        result = new Set();
        return;
      }
      result = new Set([...result].filter((id) => candidates.has(id)));
    };

    if (query.originPlace?.trim()) intersect(maps.byOrigin.get(query.originPlace.trim()));
    if (query.officeName?.trim()) intersect(maps.byOffice.get(query.officeName.trim()));
    if (query.nobleTitle?.fief?.trim() || query.nobleTitle?.roleName?.trim()) {
      intersect(
        maps.byTitle.get(titleKey(query.dynasty, query.nobleTitle.fief, query.nobleTitle.roleName)),
      );
    }

    return [...(result ?? [])];
  }

  return { resolve };
}

/**
 * Build a queryable index over Norbert person records (`norbert-persons`
 * pack), for resolving a person-wrapper's found dynasty/office/title/origin/
 * name combination against the database. Every field a `Person` record
 * already carries — `metadata.origin` (person_origin), `metadata.appointments`
 * (officeholding_raw), `metadata.nobleTitles` + `metadata.dynasty` (person_nt)
 * — is reused as-is; nothing new is compiled for this.
 */
export function buildWrapperDisambiguationIndex(
  persons: readonly AuthorityCandidate[],
): WrapperDisambiguationIndex {
  const maps: DisambiguationMaps = {
    byPersName: new Map(),
    byOrigin: new Map(),
    byOffice: new Map(),
    byTitle: new Map(),
  };

  for (const person of persons) {
    if (person.kind !== 'person') continue;
    const id = person.authorityId;

    // Identity variants: given name alone, and surname+given name — the
    // same two forms `personWrappers.mjs` compiles as separate wrapper
    // records. Falls back to whatever coarser name is on file when 姓/名
    // aren't split out separately (e.g. a non-Han name).
    const given = (person.names ?? [])
      .filter((name) => name.type === 'given')
      .map((name) => name.text.trim())
      .filter(Boolean);
    const family = (person.names ?? [])
      .filter((name) => name.type === 'family')
      .map((name) => name.text.trim())
      .filter(Boolean);
    const identities = new Set<string>();
    for (const g of given) identities.add(g);
    for (const f of family) for (const g of given) identities.add(`${f}${g}`);
    if (identities.size === 0) {
      for (const name of person.names ?? []) {
        if (name.type === 'primary' || name.type === 'wrapper-person') {
          const text = name.text.trim();
          if (text) identities.add(text);
        }
      }
    }
    for (const identity of identities) addToSet(maps.byPersName, identity, id);

    for (const origin of person.metadata?.origin ?? []) {
      addToSet(maps.byOrigin, origin.placeName, id);
    }
    for (const appointment of person.metadata?.appointments ?? []) {
      addToSet(maps.byOffice, appointment.office.name, id);
    }
    for (const title of person.metadata?.nobleTitles ?? []) {
      // A title's own dynasty (person_nt.dyn) is the precise context for
      // that specific title — a person can hold titles across more than one
      // reign/dynasty. Only fall back to the person's overall dynasty label
      // when the title itself doesn't carry one.
      const dynasty = title.dynasty ?? person.metadata?.dynasty;
      addToSet(maps.byTitle, titleKey(dynasty, title.fief, title.roleName), id);
    }
  }

  return indexFromMaps(maps);
}

/** Load the index straight from the `norbert-persons` pack's raw NDJSON content. */
export function wrapperDisambiguationIndexFromPack(
  content: AuthorityPackContent,
): WrapperDisambiguationIndex {
  return buildWrapperDisambiguationIndex([...iterateAuthorityNdjson(content)]);
}

/**
 * Build a queryable index over this project's own harvested wrapper facts
 * (`wrapperFactsLog.ts`) — the exact dynasty/office/title/origin/name
 * combinations already confirmed here, each mapping straight to the entity
 * it resolved to. No regeneration: a fact only ever indexes the fields it
 * actually carries.
 */
export function buildWrapperDisambiguationIndexFromFacts(
  facts: readonly WrapperFactRecord[],
): WrapperDisambiguationIndex {
  const maps: DisambiguationMaps = {
    byPersName: new Map(),
    byOrigin: new Map(),
    byOffice: new Map(),
    byTitle: new Map(),
  };

  for (const fact of facts) {
    const { query, entityId } = fact;
    addToSet(maps.byPersName, query.persName, entityId);
    if (query.originPlace) addToSet(maps.byOrigin, query.originPlace, entityId);
    if (query.officeName) addToSet(maps.byOffice, query.officeName, entityId);
    if (query.nobleTitle?.fief || query.nobleTitle?.roleName) {
      addToSet(
        maps.byTitle,
        titleKey(query.dynasty, query.nobleTitle.fief, query.nobleTitle.roleName),
        entityId,
      );
    }
  }

  return indexFromMaps(maps);
}

const elementName = (element: Element): string => element.localName || element.nodeName;

/** The identity-bearing child of a person wrapper — the persName with no `type` (not a posthumous/temple name). */
export function wrapperIdentityElement(wrapper: Element): Element | null {
  return (
    Array.from(wrapper.children).find(
      (child) => elementName(child) === 'persName' && !child.getAttribute('type'),
    ) ?? null
  );
}

/**
 * Read an applied `<name type="personWrapper">` element's structured
 * children into a {@link WrapperDisambiguationQuery}. Returns null when
 * there's no identity to resolve at all.
 */
export function wrapperDisambiguationQueryFromElement(
  wrapper: Element,
): WrapperDisambiguationQuery | null {
  const identity = wrapperIdentityElement(wrapper);
  const persName = identity?.textContent?.trim();
  if (!persName) return null;

  const children = Array.from(wrapper.children);
  const textOf = (name: string) =>
    children.find((child) => elementName(child) === name)?.textContent?.trim() || undefined;
  const dynasty = textOf('nationality');
  const officeName = textOf('roleName');
  const originPlace = textOf('placeName');

  const nobleTitleEl = children.find((child) => elementName(child) === 'nobleTitle');
  const nobleTitleParts = nobleTitleEl ? Array.from(nobleTitleEl.children) : [];
  const fief = nobleTitleParts
    .find((part) => elementName(part) === 'placeName')
    ?.textContent?.trim();
  const titleRole = nobleTitleParts
    .find((part) => elementName(part) === 'roleName')
    ?.textContent?.trim();

  return {
    persName,
    ...(dynasty ? { dynasty } : {}),
    ...(officeName ? { officeName } : {}),
    ...(originPlace ? { originPlace } : {}),
    ...(fief || titleRole ? { nobleTitle: { fief, roleName: titleRole } } : {}),
  };
}
