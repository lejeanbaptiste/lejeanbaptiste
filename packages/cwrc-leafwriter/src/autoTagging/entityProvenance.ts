/**
 * Field-level provenance for entities.xml.
 *
 * The original entity format only recorded provenance on the entity or on an
 * authority-cache note. These attributes make individual values refreshable:
 * user values survive refreshes, while authority/XML values can be accepted,
 * rejected, or withdrawn independently.
 */

export type EntityValueOrigin = 'user' | 'authority' | 'xml';
export type EntityValueStatus = 'active' | 'rejected' | 'withdrawn';

export const ENTITY_ORIGIN_ATTR = 'origin';
export const ENTITY_SOURCE_ATTR = 'source';
export const ENTITY_STATUS_ATTR = 'status';

export interface EntityValueProvenance {
  origin: EntityValueOrigin;
  source: string | null;
  status: EntityValueStatus;
}

const isOrigin = (value: string | null): value is EntityValueOrigin =>
  value === 'user' || value === 'authority' || value === 'xml';

const isStatus = (value: string | null): value is EntityValueStatus =>
  value === 'active' || value === 'rejected' || value === 'withdrawn';

/** Infer a safe origin for legacy values that have no new attributes. */
export function readEntityValueProvenance(element: Element): EntityValueProvenance {
  const explicitOrigin = element.getAttribute(ENTITY_ORIGIN_ATTR);
  const source = element.getAttribute(ENTITY_SOURCE_ATTR)?.trim() || null;
  const rawStatus = element.getAttribute(ENTITY_STATUS_ATTR);
  const status: EntityValueStatus = isStatus(rawStatus) ? rawStatus : 'active';

  if (isOrigin(explicitOrigin)) return { origin: explicitOrigin, source, status };

  // Existing authority-cache notes and auto-tagged values are authority data.
  if (
    element.localName === 'idno' ||
    element.getAttribute('type') === 'authority-cache' ||
    element.getAttribute('resp') === '#grognard-autotag' ||
    element.getAttribute('resp') === '#leafwriter-autotag'
  ) {
    return { origin: 'authority', source, status };
  }
  return { origin: 'user', source, status };
}

export function writeEntityValueProvenance(
  element: Element,
  provenance: Partial<EntityValueProvenance> & { origin: EntityValueOrigin },
): void {
  element.setAttribute(ENTITY_ORIGIN_ATTR, provenance.origin);
  if (provenance.source?.trim()) element.setAttribute(ENTITY_SOURCE_ATTR, provenance.source.trim());
  else element.removeAttribute(ENTITY_SOURCE_ATTR);
  if (provenance.status && provenance.status !== 'active') {
    element.setAttribute(ENTITY_STATUS_ATTR, provenance.status);
  } else {
    element.removeAttribute(ENTITY_STATUS_ATTR);
  }
}

export function isActiveEntityValue(element: Element): boolean {
  return readEntityValueProvenance(element).status === 'active';
}

export function isRefreshableEntityValue(element: Element): boolean {
  const { origin } = readEntityValueProvenance(element);
  return origin === 'authority' || origin === 'xml';
}

/** A stable key used by refresh/rejection reconciliation. */
export function entityValueKey(element: Element): string {
  const p = readEntityValueProvenance(element);
  // Origin is deliberately excluded: validation changes authority/XML data to
  // user data, but the assertion must keep the same stable identity.
  return [element.localName, p.source ?? '', element.textContent?.trim() ?? ''].join('\u001f');
}

export function entityOriginLabel(origin: EntityValueOrigin): string {
  return origin === 'authority' ? 'authority' : origin === 'xml' ? 'XML' : 'user';
}
