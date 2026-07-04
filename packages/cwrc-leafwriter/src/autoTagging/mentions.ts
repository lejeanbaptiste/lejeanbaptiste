import { buildDocIndex, createAnchor, type DocIndex, type OccurrenceCache } from './anchor';
import { TAG_TO_KIND } from './entities';
import type { Anchor, WhitespacePolicy } from './types';

export interface MentionInstance {
  documentId: string;
  tag: string;
  surface: string;
  element: Element;
  anchor: Anchor;
  hasKey: boolean;
  isUnresolved: boolean;
}

export interface MentionGroup {
  tag: string;
  surface: string;
  instances: MentionInstance[];
  /** True when every instance in the group has @key. */
  fullyResolved: boolean;
}

const DISAMBIGUATION_TAGS = Object.keys(TAG_TO_KIND);

function mentionFromElement(
  element: Element,
  doc: Document,
  policy: WhitespacePolicy,
  documentId: string,
  index: DocIndex,
  occurrenceCache: OccurrenceCache,
): MentionInstance | null {
  const tag = element.nodeName;
  const surface = (element.textContent ?? '').trim();
  if (!surface) return null;

  const key = element.getAttribute('key')?.trim() ?? '';
  const cert = element.getAttribute('cert')?.trim() ?? '';
  const hasKey = key.length > 0;
  const isUnresolved = cert === 'unknown' && !hasKey;

  const textNode = findPrimaryTextNode(element);
  if (!textNode) return null;

  const rawStart = 0;
  const rawEnd = textNode.data.length;
  const anchor = createAnchor(
    documentId,
    doc.documentElement,
    textNode,
    rawStart,
    rawEnd,
    policy,
    index,
    occurrenceCache,
  );

  return {
    documentId,
    tag,
    surface,
    element,
    hasKey,
    isUnresolved,
    anchor,
  };
}

function findPrimaryTextNode(element: Element): Text | null {
  const walker = element.ownerDocument!.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node as Text).data.trim();
    if (text.length > 0) return node as Text;
  }
  return null;
}

/** Collect mention groups from a single document. */
export function collectMentions(
  doc: Document,
  policy: WhitespacePolicy,
  documentId = 'current',
  options: { includeResolved?: boolean } = {},
): MentionGroup[] {
  const includeResolved = options.includeResolved ?? false;
  const byKey = new Map<string, MentionInstance[]>();
  const index = buildDocIndex(doc.documentElement, policy);
  const occurrenceCache: OccurrenceCache = new Map();

  for (const tag of DISAMBIGUATION_TAGS) {
    const elements = doc.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      const el = elements.item(i);
      if (!el) continue;
      const mention = mentionFromElement(el, doc, policy, documentId, index, occurrenceCache);
      if (!mention) continue;
      if (mention.hasKey && !includeResolved) continue;
      const groupKey = `${mention.tag}\0${mention.surface}`;
      const list = byKey.get(groupKey) ?? [];
      list.push(mention);
      byKey.set(groupKey, list);
    }
  }

  const groups: MentionGroup[] = [];
  for (const instances of byKey.values()) {
    const first = instances[0]!;
    groups.push({
      tag: first.tag,
      surface: first.surface,
      instances,
      fullyResolved: instances.every((m) => m.hasKey),
    });
  }

  return groups.sort((a, b) => a.surface.localeCompare(b.surface, 'zh-Hans'));
}

/** Merge mention groups from multiple documents by (tag, surface). */
export function mergeMentionGroups(groups: MentionGroup[]): MentionGroup[] {
  const byKey = new Map<string, MentionGroup>();
  for (const group of groups) {
    const key = `${group.tag}\0${group.surface}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...group, instances: [...group.instances] });
      continue;
    }
    existing.instances.push(...group.instances);
    existing.fullyResolved = existing.instances.every((m) => m.hasKey);
  }
  return [...byKey.values()].sort((a, b) => a.surface.localeCompare(b.surface, 'zh-Hans'));
}

/** Strip @key only from all disambiguation tags in the document. */
export function purgeEntityKeys(doc: Document): number {
  let count = 0;
  for (const tag of DISAMBIGUATION_TAGS) {
    const elements = doc.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      const el = elements.item(i);
      if (!el?.hasAttribute('key')) continue;
      el.removeAttribute('key');
      count += 1;
    }
  }
  return count;
}

/** Mark element unresolved: cert="unknown", no @key. */
export function markMentionUnresolved(element: Element): void {
  element.removeAttribute('key');
  element.setAttribute('cert', 'unknown');
}

/** Assign local entity id to mention element. */
export function assignEntityKey(element: Element, entityId: string, resp?: string): void {
  element.setAttribute('key', entityId);
  element.removeAttribute('cert');
  if (resp) element.setAttribute('resp', resp);
}
