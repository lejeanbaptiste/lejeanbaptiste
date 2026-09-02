/**
 * Replace AI `{{mention:N}}` placeholders with mention-faithful entity fields.
 */

import { dateFormatSettingsForLang } from './dateFormatSettings';
import { deriveDisplaySpec, isCharacterOnlyTranslationTarget, type MentionContext } from './mentionContext';
import { buildCjkMentionParts, buildWesternMentionParts } from './mentionRender';
import { countPriorEntityRefsInDocument } from './fileWideOccurrence';
import { normalizeAiPlaceholders } from './normalizeAiPlaceholders';
import { stripLeadingOfficePrepositionsFromText } from './stripOfficePrepositions';
import { createEntityFieldElement, createMentionFieldElement } from './translationEntityFields';
import { EMPTY_DISPLAY_SPEC } from './entityDisplay';
import type { EntitySummary } from './entitySummary';

const MENTION_PLACEHOLDER_RE = /\{\{(?:holding:|as:)?mention:(\d+)\}\}/g;

export interface SubstituteMentionOptions {
  lang?: string | null;
  sourceLang?: string | null;
  translationDoc?: Document | null;
  alignmentUnit?: 'div' | 'p' | 'ab';
  sourceFileName?: string;
  unitId?: string;
  /** Same-key refs in companion units before `unitId` (batch translate). */
  fileOccurrenceOffsetByKey?: ReadonlyMap<string, number>;
}

const mentionTokenPrefix = (mention: MentionContext): string => {
  if (mention.placeholderRole === 'holding') return 'holding:';
  if (mention.placeholderRole === 'as') return 'as:';
  return 'mention:';
};

export const substituteMentionPlaceholders = (
  fragmentXml: string,
  manifest: MentionContext[],
  entities: Map<string, EntitySummary>,
  options: SubstituteMentionOptions = {},
): string => {
  const cleanedFragment = stripLeadingOfficePrepositionsFromText(
    normalizeAiPlaceholders(fragmentXml),
  );
  if (!cleanedFragment.includes('{{mention:')) return cleanedFragment;

  const settings = dateFormatSettingsForLang(options.lang);
  const cjk = isCharacterOnlyTranslationTarget(options.lang);
  const wrapped = `<fragment>${cleanedFragment}</fragment>`;
  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = doc.body.querySelector('fragment') ?? doc.body;

  const unitOccurrenceCounts = new Map<string, number>();
  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if ((node.textContent ?? '').includes('{{mention:')) textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const text = stripLeadingOfficePrepositionsFromText(
      normalizeAiPlaceholders(textNode.textContent ?? ''),
    );
    MENTION_PLACEHOLDER_RE.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const replacement = doc.createDocumentFragment();
    let sawMatch = false;

    while ((match = MENTION_PLACEHOLDER_RE.exec(text))) {
      sawMatch = true;
      if (match.index > lastIndex) {
        replacement.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }

      const mentionIndex = Number(match[1]);
      const mention = manifest[mentionIndex];
      if (!mention) {
        console.warn('[translation] unknown mention index:', mentionIndex);
        replacement.appendChild(doc.createTextNode(match[0]));
        lastIndex = MENTION_PLACEHOLDER_RE.lastIndex;
        continue;
      }

      const entity = entities.get(mention.key);
      if (!entity) {
        console.warn('[translation] mention had no matching entity:', mention.key);
        replacement.appendChild(doc.createTextNode(match[0]));
        lastIndex = MENTION_PLACEHOLDER_RE.lastIndex;
        continue;
      }

      const withinUnit = (unitOccurrenceCounts.get(mention.key) ?? 0) + 1;
      unitOccurrenceCounts.set(mention.key, withinUnit);

      let priorInFile = options.fileOccurrenceOffsetByKey?.get(mention.key) ?? 0;
      if (
        !options.fileOccurrenceOffsetByKey &&
        options.translationDoc &&
        options.alignmentUnit &&
        options.sourceFileName &&
        options.unitId
      ) {
        priorInFile = countPriorEntityRefsInDocument(
          options.translationDoc,
          options.alignmentUnit,
          options.sourceFileName,
          options.unitId,
          mention.key,
        );
      }

      const fileOccurrenceIndex = priorInFile + withinUnit;
      const displaySpec = deriveDisplaySpec(
        mention.role,
        fileOccurrenceIndex,
        settings.bracketsPolicy,
      );
      const parts = cjk
        ? buildCjkMentionParts(mention, entity, fileOccurrenceIndex, displaySpec, settings, options.lang)
        : buildWesternMentionParts(
            mention,
            entity,
            fileOccurrenceIndex,
            displaySpec,
            settings,
            options.sourceLang,
          );

      replacement.appendChild(createMentionFieldElement(entity, mention, parts, displaySpec));
      lastIndex = MENTION_PLACEHOLDER_RE.lastIndex;
    }

    if (!sawMatch) continue;
    if (lastIndex < text.length) {
      replacement.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(replacement, textNode);
  }

  return root.innerHTML;
};

/** @deprecated Legacy entity-key placeholders; prefer {@link substituteMentionPlaceholders}. */
export const substituteEntityPlaceholders = (
  fragmentXml: string,
  entities: Map<string, EntitySummary>,
  lang?: string | null,
): string => {
  const cleanedFragment = stripLeadingOfficePrepositionsFromText(
    normalizeAiPlaceholders(fragmentXml),
  );
  if (
    !cleanedFragment.includes('{{entity:') &&
    !cleanedFragment.includes('{{holding:') &&
    !cleanedFragment.includes('{{as:')
  ) {
    return cleanedFragment;
  }

  const ENTITY_PLACEHOLDER_RE = /\{\{(?:entity|holding|as):(?!opaque:)([^{}]+)\}\}/g;
  const wrapped = `<fragment>${cleanedFragment}</fragment>`;
  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = doc.body.querySelector('fragment') ?? doc.body;

  const occurrenceCounts = new Map<string, number>();
  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const content = node.textContent ?? '';
    if (
      content.includes('{{entity:') ||
      content.includes('{{holding:') ||
      content.includes('{{as:')
    ) {
      textNodes.push(node as Text);
    }
  }

  for (const textNode of textNodes) {
    const text = stripLeadingOfficePrepositionsFromText(
      normalizeAiPlaceholders(textNode.textContent ?? ''),
    );
    ENTITY_PLACEHOLDER_RE.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const replacement = doc.createDocumentFragment();
    let sawMatch = false;

    while ((match = ENTITY_PLACEHOLDER_RE.exec(text))) {
      sawMatch = true;
      if (match.index > lastIndex) {
        replacement.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }
      const entityId = match[1]!.trim();
      const entity = entities.get(entityId);
      if (entity) {
        const nextOccurrence = (occurrenceCounts.get(entityId) ?? 0) + 1;
        occurrenceCounts.set(entityId, nextOccurrence);
        replacement.appendChild(
          createEntityFieldElement(entity, nextOccurrence, EMPTY_DISPLAY_SPEC, undefined, lang),
        );
      } else {
        replacement.appendChild(doc.createTextNode(match[0]));
      }
      lastIndex = ENTITY_PLACEHOLDER_RE.lastIndex;
    }
    if (!sawMatch) continue;
    if (lastIndex < text.length) {
      replacement.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(replacement, textNode);
  }

  return root.innerHTML;
};

export { mentionTokenPrefix };
