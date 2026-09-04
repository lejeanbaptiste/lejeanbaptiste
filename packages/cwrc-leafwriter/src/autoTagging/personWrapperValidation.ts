export interface PersonWrapperValidation {
  valid: boolean;
  errors: string[];
  /** Wrappers deliberately awaiting person disambiguation. */
  pending?: number;
}

const ALLOWED_CHILDREN = new Set([
  'persName',
  'roleName',
  'placeName',
  'nobleTitle',
  'nationality',
]);

/**
 * Canonical order for a person wrapper's top-level children: dynasty/court
 * affiliation, then an ordinary office, then a noble title (its own fief +
 * rank + posthumous name nested inside), then the person's origin place,
 * then the identity itself — always last. Every slot but `persName` is
 * optional, but whichever are present must appear in this relative order.
 */
export const PERSON_WRAPPER_CHILD_ORDER: Record<string, number> = {
  nationality: 0,
  roleName: 1,
  nobleTitle: 2,
  placeName: 3,
  persName: 4,
};

const elementName = (element: Element): string => element.localName || element.nodeName;

/** Flag any child that sits out of the canonical nationality→roleName→nobleTitle→placeName→persName order. */
function validateChildOrder(children: Element[], errors: string[]): void {
  let previousOrder = -1;
  let previousName = '';
  for (const child of children) {
    const name = elementName(child);
    const order = PERSON_WRAPPER_CHILD_ORDER[name];
    if (order == null) continue; // unsupported child — already flagged separately
    if (order < previousOrder) {
      errors.push(
        `personWrapper children out of order: ${name} follows ${previousName}, but the order must be nationality, roleName, nobleTitle, placeName, then persName`,
      );
    }
    previousOrder = Math.max(previousOrder, order);
    previousName = name;
  }
}

/** Validate one resolved, document-level Norbert person wrapper. */
export function validatePersonWrapper(wrapper: Element): PersonWrapperValidation {
  const errors: string[] = [];
  let pending = 0;
  if (elementName(wrapper) !== 'name' || wrapper.getAttribute('type') !== 'personWrapper') {
    errors.push('element must be name type="personWrapper"');
  }

  const key = wrapper.getAttribute('key')?.trim();
  if (!key) {
    if (wrapper.getAttribute('cert') === 'unknown') pending = 1;
    else errors.push('personWrapper requires exactly one person key');
  }

  const children = Array.from(wrapper.children);
  if (children.length === 0) errors.push('personWrapper must contain tagged components');
  for (const child of children) {
    const name = elementName(child);
    if (!ALLOWED_CHILDREN.has(name)) errors.push(`unsupported child: ${name}`);
    if (name === 'nobleTitle') validateNobleTitle(child, errors);
  }
  validateChildOrder(children, errors);

  const names = children.filter((child) => elementName(child) === 'persName');
  if (names.length === 0 && !wrapper.querySelector('persName')) {
    errors.push('personWrapper must contain a persName');
  }
  // A lone persName is never worth wrapping — there must be at least one
  // other (leading) component alongside it.
  if (children.length > 0 && children.every((child) => elementName(child) === 'persName')) {
    errors.push('personWrapper must contain persName plus at least one other component');
  }
  const identity = Array.from(wrapper.getElementsByTagName('persName')).find(
    (person) => !person.getAttribute('type'),
  );
  const identityKey = identity?.getAttribute('key')?.trim();
  if (key && identity && !identityKey && !pending) {
    errors.push('personWrapper inner persName requires the wrapper person key');
  } else if (key && identityKey && identityKey !== key) {
    errors.push('personWrapper and inner persName keys conflict');
  }

  return pending > 0
    ? { valid: errors.length === 0, errors, pending }
    : { valid: errors.length === 0, errors };
}

function validateNobleTitle(title: Element, errors: string[]): void {
  const parts = Array.from(title.children);
  const hasPlace = parts.some((part) => elementName(part) === 'placeName');
  const hasRole = parts.some((part) => elementName(part) === 'roleName');
  if (!hasPlace && !hasRole) errors.push('nobleTitle must contain a placeName or roleName');
  for (const part of parts) {
    const name = elementName(part);
    if (!['placeName', 'roleName', 'persName'].includes(name)) {
      errors.push(`unsupported nobleTitle child: ${name}`);
    }
  }
}

/** Validate every person wrapper in a document. */
export function validatePersonWrappers(doc: Document): PersonWrapperValidation {
  const errors: string[] = [];
  let pending = 0;
  for (const wrapper of Array.from(doc.getElementsByTagName('name'))) {
    if (wrapper.getAttribute('type') !== 'personWrapper') continue;
    const result = validatePersonWrapper(wrapper);
    errors.push(...result.errors.map((error) => `${error} (${wrapper.textContent?.trim() ?? ''})`));
    pending += result.pending ?? 0;
  }
  return pending > 0
    ? { valid: errors.length === 0, errors, pending }
    : { valid: errors.length === 0, errors };
}
