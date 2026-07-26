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

const elementName = (element: Element): string => element.localName || element.nodeName;

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

  const names = children.filter((child) => elementName(child) === 'persName');
  if (names.length === 0 && !wrapper.querySelector('persName')) {
    errors.push('personWrapper must contain a persName');
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
  return pending > 0 ? { valid: errors.length === 0, errors, pending } : { valid: errors.length === 0, errors };
}
