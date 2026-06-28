/** Mirror of LEAF-Writer RESERVED_ATTRIBUTES — attrs not editable in popups/panel. */
export const RESERVED_ATTRIBUTE_NAMES = new Set([
  'id',
  'name',
  'class',
  'style',
  '_entity',
  '_type',
  '_tag',
  '_textallowed',
  '_note',
  '_candidate',
  '_attributes',
  'data-mce-type',
  'xmlns',
  'xml:lang',
  'xml:space',
]);

export const isEditableAttributeName = (name: string): boolean =>
  name.trim().length > 0 && !RESERVED_ATTRIBUTE_NAMES.has(name);
