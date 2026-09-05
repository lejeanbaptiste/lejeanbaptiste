/** Project-scoped, user-defined `<rs>` sub-categories (e.g. "philosophical concept"). */
export interface CustomThingType {
  /** Slug; becomes the literal `@type` value written on `<rs>` and read back on mint. */
  id: string;
  label: string;
}

const CUSTOM_ID_RE = /^[a-z][a-z0-9_-]*$/;

export type CustomThingTypeIdError = 'invalid_slug' | 'reserved';

/** Returns an error code, or null when the id is valid. */
export function validateCustomThingTypeId(id: string): CustomThingTypeIdError | null {
  const trimmed = id.trim();
  if (!CUSTOM_ID_RE.test(trimmed)) {
    return 'invalid_slug';
  }
  // 'thing' is the generic default @type stamped by the Enter-popup/wrap
  // commands when no specific sub-type is chosen — a custom type can't reuse it.
  if (trimmed === 'thing') {
    return 'reserved';
  }
  return null;
}
