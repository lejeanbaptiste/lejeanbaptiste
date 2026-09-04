/**
 * Auto-resolve noble-title components during Disambiguate scans.
 *
 * Policy:
 *  - Inside `<nobleTitle>`, only the fief `<placeName>` belongs in the
 *    Disambiguate queue (see `collectMentions`).
 *  - Closed-set ranks (`王` / `公` / `公主` / …) auto-link when exactly one
 *    local office entity matches.
 *  - A title with place + role + posthumous that uniquely identifies a local
 *    person (or a unique pack title whose Norbert person is already in PEDB)
 *    keys the surrounding personWrapper / identity persName.
 *  - Posthumous names never resolve as standalone persons.
 */

import { assignEntity } from './apply';
import { formatNorbertAuthorityValue } from './norbertAuthorityId';
import { isNobleTitleRank } from './nobleTitleSpanParser';

function localNameOf(node: Node): string {
  return (node as Element).localName || node.nodeName;
}

/** True when `element` sits under a `<nobleTitle>`. */
export function isInsideNobleTitle(element: Element): boolean {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (localNameOf(ancestor) === 'nobleTitle') return true;
  }
  return false;
}

function isPersonWrapper(element: Element): boolean {
  return localNameOf(element) === 'name' && element.getAttribute('type') === 'personWrapper';
}

function wrapperPersonName(wrapper: Element): Element | null {
  return (
    Array.from(wrapper.getElementsByTagName('persName')).find(
      (element) => !element.getAttribute('type'),
    ) ?? null
  );
}

/** Skip whitespace-only text nodes; return the next element sibling, if adjacent. */
function nextAdjacentElement(element: Element): Element | null {
  let cursor: ChildNode | null = element.nextSibling;
  while (cursor && cursor.nodeType === 3 && !(cursor.textContent ?? '').trim()) {
    cursor = cursor.nextSibling;
  }
  return cursor && cursor.nodeType === 1 ? (cursor as Element) : null;
}

export interface NobleTitlePartsFromDom {
  title: Element;
  placeEl: Element | null;
  roleEl: Element | null;
  posthumousEl: Element | null;
  place: string;
  role: string;
  posthumous: string;
}

/** Read the structured children of one `<nobleTitle>`. */
export function readNobleTitleParts(title: Element): NobleTitlePartsFromDom {
  let placeEl: Element | null = null;
  let roleEl: Element | null = null;
  let posthumousEl: Element | null = null;
  for (const child of Array.from(title.children)) {
    const tag = localNameOf(child);
    if (tag === 'placeName' && !placeEl) placeEl = child;
    else if (tag === 'roleName' && !roleEl) roleEl = child;
    else if (tag === 'persName' && child.getAttribute('type') === 'posthumous' && !posthumousEl) {
      posthumousEl = child;
    }
  }
  return {
    title,
    placeEl,
    roleEl,
    posthumousEl,
    place: placeEl?.textContent?.trim() ?? '',
    role: roleEl?.textContent?.trim() ?? '',
    posthumous: posthumousEl?.textContent?.trim() ?? '',
  };
}

/** Signature used to index known titles for unique person lookup. */
export function nobleTitleMatchKey(place: string, role: string, posthumous: string): string {
  return `${place}\0${role}\0${posthumous}`;
}

/**
 * Build place|role|posthumous → personId from PEDB candidate records.
 * Only indexes rows that have all three components (the strong auto-resolve case).
 */
export function buildPersonTitleIndex(
  records: readonly {
    id: string;
    nobleTitles?:
      | readonly {
          fief?: string | null;
          roleName?: string | null;
          posthumousName?: string | null;
        }[]
      | null;
  }[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const record of records) {
    for (const title of record.nobleTitles ?? []) {
      const place = title.fief?.trim() ?? '';
      const role = title.roleName?.trim() ?? '';
      const posthumous = title.posthumousName?.trim() ?? '';
      if (!place || !role || !posthumous) continue;
      const key = nobleTitleMatchKey(place, role, posthumous);
      const list = index.get(key) ?? [];
      if (!list.includes(record.id)) list.push(record.id);
      index.set(key, list);
    }
  }
  return index;
}

/** Signature for the relaxed, fief+role-only title lookup (see {@link buildTitleOnlyPersonIndex}). */
export function titleOnlyMatchKey(place: string, role: string): string {
  return `${place}\0${role}`;
}

/**
 * Build fief|role → personId(s) from PEDB candidate records — deliberately
 * looser than {@link buildPersonTitleIndex} (no posthumous-name requirement),
 * for the case a title is mentioned with no name attached at all (e.g.
 * `建安王薨`, nobody's name in sight). A living title never carries a
 * posthumous name, so the strong-match index can never help there. This is
 * expected to return more than one id often — many people can hold the same
 * fief+rank across different reigns — so it feeds the ordinary Disambiguate
 * candidate list, never an auto-resolve.
 */
export function buildTitleOnlyPersonIndex(
  records: readonly {
    id: string;
    nobleTitles?: readonly { fief?: string | null; roleName?: string | null }[] | null;
  }[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const record of records) {
    for (const title of record.nobleTitles ?? []) {
      const place = title.fief?.trim() ?? '';
      const role = title.roleName?.trim() ?? '';
      if (!place || !role) continue;
      const key = titleOnlyMatchKey(place, role);
      const list = index.get(key) ?? [];
      if (!list.includes(record.id)) list.push(record.id);
      index.set(key, list);
    }
  }
  return index;
}

/**
 * A person wrapper's own `<nobleTitle>` fief+rank, but only when the
 * wrapper's identity `<persName>` is empty — i.e. the title was mentioned
 * with no name attached (`parseChildlessNobleTitles`'s no-personSlot case).
 * A wrapper that already has a real name uses the ordinary surface-based
 * Disambiguate path instead; this is strictly for the nameless case.
 */
export function bareNobleTitleQuery(wrapper: Element): { fief: string; roleName: string } | null {
  if (localNameOf(wrapper) !== 'name' || wrapper.getAttribute('type') !== 'personWrapper') {
    return null;
  }
  const identity = Array.from(wrapper.getElementsByTagName('persName')).find(
    (person) => !person.getAttribute('type'),
  );
  if (!identity || identity.textContent?.trim()) return null;
  const title = Array.from(wrapper.children).find((child) => localNameOf(child) === 'nobleTitle');
  if (!title) return null;
  const fief = Array.from(title.children)
    .find((part) => localNameOf(part) === 'placeName')
    ?.textContent?.trim();
  const roleName = Array.from(title.children)
    .find((part) => localNameOf(part) === 'roleName')
    ?.textContent?.trim();
  if (!fief || !roleName) return null;
  return { fief, roleName };
}

/**
 * Index wiki-nt / Norbert title candidates that carry place+role+posthumous
 * and a linked Norbert person id, for PEDB authority lookup.
 */
export function buildPackTitleNorbertIndex(
  candidates: readonly {
    metadata?: {
      isNobleTitle?: boolean;
      nobleTitle?: {
        fief?: string | null;
        roleName?: string | null;
        posthumousName?: string | null;
      } | null;
      wrapper?: { personId?: string | null } | null;
      crosswalk?: { norbert?: string | string[] | null } | null;
    } | null;
  }[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const candidate of candidates) {
    const title = candidate.metadata?.nobleTitle;
    if (!candidate.metadata?.isNobleTitle || !title) continue;
    const place = title.fief?.trim() ?? '';
    const role = title.roleName?.trim() ?? '';
    const posthumous = title.posthumousName?.trim() ?? '';
    if (!place || !role || !posthumous) continue;
    const crosswalkNorbert = candidate.metadata.crosswalk?.norbert;
    const fromCrosswalk = Array.isArray(crosswalkNorbert) ? crosswalkNorbert[0] : crosswalkNorbert;
    const raw = candidate.metadata.wrapper?.personId?.trim() || fromCrosswalk?.trim();
    if (!raw) continue;
    const norbertId = formatNorbertAuthorityValue('person', raw);
    const key = nobleTitleMatchKey(place, role, posthumous);
    const list = index.get(key) ?? [];
    if (!list.includes(norbertId)) list.push(norbertId);
    index.set(key, list);
  }
  return index;
}

export interface AutoResolveNobleTitlesDeps {
  /** Local office entity ids whose primary/alias exactly matches the rank. */
  findOfficeIds: (rank: string) => Promise<string[]> | string[];
  /** Optional: unique Norbert office authority value when no local office exists. */
  findPackOfficeAuthority?: (rank: string) => Promise<string | null> | string | null;
  /** PEDB person ids that carry this exact place+role+posthumous title. */
  findPersonIdsByTitle: (parts: {
    place: string;
    role: string;
    posthumous: string;
  }) => Promise<string[]> | string[];
  /** Extra ranks from the live noble-title vocabulary (beyond SEED_RANKS). */
  vocabularyRanks?: ReadonlySet<string> | null;
}

export interface AutoResolveNobleTitlesResult {
  resolvedRanks: number;
  resolvedRankRefs: number;
  resolvedPersons: number;
  changed: boolean;
}

/**
 * Walk every `<nobleTitle>` in `doc` and auto-resolve ranks / known persons.
 * Returns whether the document was mutated (caller should persist).
 */
export async function autoResolveNobleTitles(
  doc: Document,
  deps: AutoResolveNobleTitlesDeps,
): Promise<AutoResolveNobleTitlesResult> {
  let resolvedRanks = 0;
  let resolvedRankRefs = 0;
  let resolvedPersons = 0;

  for (const title of Array.from(doc.getElementsByTagName('nobleTitle'))) {
    const parts = readNobleTitleParts(title);

    if (parts.roleEl && isNobleTitleRank(parts.role, deps.vocabularyRanks)) {
      const alreadyKeyed = Boolean(parts.roleEl.getAttribute('key')?.trim());
      const alreadyReffed = Boolean(parts.roleEl.getAttribute('ref')?.trim());
      if (!alreadyKeyed) {
        const officeIds = [
          ...new Set(await Promise.resolve(deps.findOfficeIds(parts.role))),
        ].filter(Boolean);
        if (officeIds.length === 1) {
          assignEntity({ element: parts.roleEl, entityId: officeIds[0]! });
          resolvedRanks++;
        } else if (!alreadyReffed && deps.findPackOfficeAuthority) {
          const authority = (
            await Promise.resolve(deps.findPackOfficeAuthority(parts.role))
          )?.trim();
          if (authority) {
            parts.roleEl.setAttribute('ref', authority);
            resolvedRankRefs++;
          }
        }
      }
    }

    // Strong case only: place + rank + posthumous must all be present.
    if (!parts.place || !parts.role || !parts.posthumous) continue;

    const personIds = [
      ...new Set(
        await Promise.resolve(
          deps.findPersonIdsByTitle({
            place: parts.place,
            role: parts.role,
            posthumous: parts.posthumous,
          }),
        ),
      ),
    ].filter(Boolean);
    if (personIds.length !== 1) continue;
    const personId = personIds[0]!;

    // Prefer keying the personWrapper that contains this title, else an
    // immediately following sibling identity persName / wrapper.
    let targetWrapper: Element | null = null;
    let targetPerson: Element | null = null;
    for (let ancestor = title.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (isPersonWrapper(ancestor)) {
        targetWrapper = ancestor;
        targetPerson = wrapperPersonName(ancestor);
        break;
      }
    }
    if (!targetWrapper) {
      const sibling = nextAdjacentElement(title);
      if (sibling) {
        if (localNameOf(sibling) === 'persName' && !sibling.getAttribute('type')) {
          targetPerson = sibling;
        } else if (isPersonWrapper(sibling)) {
          targetWrapper = sibling;
          targetPerson = wrapperPersonName(sibling);
        }
      }
    }

    if (!targetPerson && !targetWrapper) continue;

    const existingPersonKey = targetPerson?.getAttribute('key')?.trim() ?? '';
    const existingWrapperKey = targetWrapper?.getAttribute('key')?.trim() ?? '';
    if (existingPersonKey && existingPersonKey !== personId) continue;
    if (existingWrapperKey && existingWrapperKey !== personId) continue;

    let linked = false;
    if (targetPerson && !existingPersonKey) {
      assignEntity({ element: targetPerson, entityId: personId });
      linked = true;
    }
    if (targetWrapper && !existingWrapperKey) {
      assignEntity({ element: targetWrapper, entityId: personId });
      linked = true;
    }
    if (linked) resolvedPersons++;
  }

  return {
    resolvedRanks,
    resolvedRankRefs,
    resolvedPersons,
    changed: resolvedRanks + resolvedRankRefs + resolvedPersons > 0,
  };
}
