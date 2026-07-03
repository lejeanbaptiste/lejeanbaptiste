import type { NodeDetail } from '@cwrc/leafwriter-validator';
import type { TagUsageStats } from './tagStats';
import { getAttrValueCounts, getProjectAttrCounts } from './tagStats';
import { getSchemaIdAttributeName, normalizeAttributeNameForSchema } from './attributeIdHelpers';
import { isEditableAttributeName } from './reservedAttributes';

export interface SchemaAttributeDetail {
  name: string;
  fullName?: string;
  invalid?: boolean;
  required?: boolean;
  choices?: string[];
  documentation?: string;
}

const getWriter = () => window.writer;

const toSchemaAttribute = (node: NodeDetail | Record<string, unknown>): SchemaAttributeDetail | null => {
  const rawName = (node as NodeDetail).name ?? (node as { name?: string }).name;
  if (!rawName) return null;

  const name = normalizeAttributeNameForSchema(rawName);
  if (!isEditableAttributeName(name)) return null;
  return {
    name,
    fullName: (node as NodeDetail).fullName ?? (node as { fullName?: string }).fullName,
    invalid: Boolean((node as NodeDetail).invalid),
    required: Boolean((node as { required?: boolean }).required),
    choices: (node as { choices?: string[] }).choices,
    documentation: (node as NodeDetail).documentation ?? (node as { documentation?: string }).documentation,
  };
};

/** Lower rank = better match when filtering attribute names. */
export const attributeNameMatchRank = (name: string, query: string): number => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return 50;

  const n = name.toLowerCase();
  if (n === trimmed) return 0;
  if (n.startsWith(trimmed)) return 1;
  if (n.endsWith(`:${trimmed}`)) return 2;
  if (n.includes(`:${trimmed}`)) return 3;
  if (n.endsWith(trimmed)) return 4;
  const index = n.indexOf(trimmed);
  if (index >= 0) return 5 + index / Math.max(n.length, 1);
  return 100;
};

export const orderAttributeSuggestions = (
  attrs: SchemaAttributeDetail[],
  tagName: string,
  stats: TagUsageStats | null | undefined,
  query: string,
): SchemaAttributeDetail[] => {
  const counts = stats ? getProjectAttrCounts(stats, tagName) : {};
  return [...attrs].sort((a, b) => {
    const aInvalid = Boolean(a.invalid);
    const bInvalid = Boolean(b.invalid);
    if (aInvalid !== bInvalid) return aInvalid ? 1 : -1;

    const rankA = attributeNameMatchRank(a.name, query);
    const rankB = attributeNameMatchRank(b.name, query);
    if (rankA !== rankB) return rankA - rankB;

    const aCount = counts[a.name] ?? 0;
    const bCount = counts[b.name] ?? 0;
    if (aCount !== bCount) return bCount - aCount;
    if (Boolean(a.required) !== Boolean(b.required)) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};

const schemaAttrsFromManager = (tagElement: Element): SchemaAttributeDetail[] => {
  const writer = getWriter();
  if (!writer?.schemaManager) return [];

  const tagName = tagElement.getAttribute('_tag') ?? '';
  const xpath = writer.utilities.getElementXPath(tagElement);
  const raw =
    (xpath ? writer.schemaManager.getAttributesForPath(xpath) : null) ??
    writer.schemaManager.getAttributesForTag(tagName) ??
    [];

  return (raw as Record<string, unknown>[])
    .map((att) => toSchemaAttribute(att))
    .filter((att): att is SchemaAttributeDetail => Boolean(att));
};

export const fetchSchemaAttributes = async (
  tagElement: Element,
): Promise<SchemaAttributeDetail[]> => {
  const writer = getWriter();
  const xpath = writer?.utilities.getElementXPath(tagElement);
  const validatorActions = writer?.overmindActions?.validator;

  if (xpath && validatorActions?.getAttributesForTagAt) {
    try {
      const nodes = await validatorActions.getAttributesForTagAt({ xpath, index: 1 });
      const fromValidator = (nodes ?? [])
        .filter((node: NodeDetail) => node.type === 'attribute')
        .map((node: NodeDetail) => toSchemaAttribute(node))
        .filter((att: SchemaAttributeDetail | null): att is SchemaAttributeDetail => Boolean(att));
      if (fromValidator.length > 0) return fromValidator;
    } catch {
      // fall through to schema manager
    }
  }

  return schemaAttrsFromManager(tagElement);
};

export const sortAttributeSuggestions = (
  attrs: SchemaAttributeDetail[],
  tagName: string,
  stats: TagUsageStats,
): SchemaAttributeDetail[] => orderAttributeSuggestions(attrs, tagName, stats, '');

export const filterAttributeSuggestions = (
  attrs: SchemaAttributeDetail[],
  query: string,
): SchemaAttributeDetail[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return attrs;
  return attrs.filter(
    (attr) =>
      attr.name.toLowerCase().includes(trimmed) ||
      attr.fullName?.toLowerCase().includes(trimmed),
  );
};

export const suggestAttributeValues = (
  tagName: string,
  attrName: string,
  stats: TagUsageStats,
  currentValue?: string,
): string[] => {
  const fromStats = Object.entries(getAttrValueCounts(stats, tagName, attrName))
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value);

  const values = [...fromStats];
  if (currentValue?.trim() && !values.includes(currentValue.trim())) {
    values.unshift(currentValue.trim());
  }
  return values;
};

export const resolveAttributeNameForApply = (
  attrs: SchemaAttributeDetail[],
  nameFilter: string,
  highlighted: SchemaAttributeDetail | null,
): SchemaAttributeDetail | null => {
  if (highlighted && !highlighted.invalid) return highlighted;

  const trimmed = nameFilter.trim();
  if (!trimmed) return null;

  const schemaId = getSchemaIdAttributeName();
  const canonical = normalizeAttributeNameForSchema(trimmed);

  const exact = attrs.find((attr) => attr.name === canonical && !attr.invalid);
  if (exact) return exact;

  if (trimmed === 'id' || canonical === schemaId) {
    const schemaIdAttr = attrs.find((attr) => attr.name === schemaId && !attr.invalid);
    if (schemaIdAttr) return schemaIdAttr;
  }

  if (isEditableAttributeName(canonical)) {
    return { name: canonical };
  }
  return null;
};
