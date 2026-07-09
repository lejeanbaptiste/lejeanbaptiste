/**
 * Assembles LLM prompts from editable templates in `./prompt-templates/`.
 * Bump versions in `prompt-templates/versions.json` when semantics change —
 * the version string is part of the LLM cache key (see llmCache.ts).
 */

import auditAddSystemTemplate from './prompt-templates/audit-add.system.txt';
import auditCleanSystemTemplate from './prompt-templates/audit-clean.system.txt';
import preambleTemplate from './prompt-templates/preamble.txt';
import suggestSystemTemplate from './prompt-templates/suggest.system.txt';
import tagDefinitions from './prompt-templates/tag-definitions.json';
import userWrapperTemplate from './prompt-templates/user.wrapper.txt';
import versions from './prompt-templates/versions.json';

export const SUGGEST_PROMPT_VERSION = versions.suggest;
export const AUDIT_CLEAN_PROMPT_VERSION = versions['audit-clean'];
export const AUDIT_ADD_PROMPT_VERSION = versions['audit-add'];
/** @deprecated Combined audit — use clean + add passes instead. */
export const AUDIT_PROMPT_VERSION = AUDIT_CLEAN_PROMPT_VERSION;

const TAG_DEFINITIONS: Record<string, string> = tagDefinitions;

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function injectPlaceholder(template: string, value: string, placeholder = '%s'): string {
  if (template.includes(placeholder)) {
    return template.replace(placeholder, value);
  }
  return template;
}

function injectTagGuide(template: string, tagGuide: string): string {
  if (template.includes('%s')) {
    return injectPlaceholder(template, tagGuide);
  }
  if (template.includes('{{TAG_GUIDE}}')) {
    return fillTemplate(template, { TAG_GUIDE: tagGuide });
  }
  return `${template}${tagGuide}`;
}

/** Tag-specific instructions included only for tags the caller requested. */
export function buildSuggestTagGuide(tags: string[]): string {
  const lines = tags
    .map((tag) => TAG_DEFINITIONS[tag])
    .filter((line): line is string => Boolean(line));
  if (lines.length === 0) return '';
  return `\n\nTagging guide (classical Chinese biography):\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

export function buildSuggestPrompt(params: {
  tags: string[];
  chunkText: string;
  before: string;
  after: string;
  /** Override shipped suggest.system.txt task body (preamble and tag guide stay locked). */
  suggestTaskText?: string;
}): { system: string; user: string } {
  const tagGuide = buildSuggestTagGuide(params.tags);
  const taskTemplate = params.suggestTaskText ?? suggestSystemTemplate;
  const system = `${preambleTemplate}${injectTagGuide(
    fillTemplate(taskTemplate, {
    TAGS: params.tags.join(', '),
    }),
    tagGuide,
  )}`;

  const user = fillTemplate(userWrapperTemplate, {
    BEFORE: params.before,
    CHUNK: params.chunkText,
    AFTER: params.after,
  });

  return { system, user };
}

export function buildAuditTagGuide(tags: string[]): string {
  const lines = tags
    .map((tag) => TAG_DEFINITIONS[tag])
    .filter((line): line is string => Boolean(line));
  if (lines.length === 0) return '';
  return `\n\nTagging guide (classical Chinese biography):\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

function buildTaggedChunkPrompt(
  systemTemplate: string,
  params: {
    tags: string[];
    taggedChunkText: string;
    before: string;
    after: string;
    taskText?: string;
  },
): { system: string; user: string } {
  const tagGuide = buildAuditTagGuide(params.tags);
  const taskTemplate = params.taskText ?? systemTemplate;
  const system = `${preambleTemplate}${injectTagGuide(
    fillTemplate(taskTemplate, {
    TAGS: params.tags.join(', '),
    }),
    tagGuide,
  )}`;

  const user = fillTemplate(userWrapperTemplate, {
    BEFORE: params.before,
    CHUNK: params.taggedChunkText,
    AFTER: params.after,
  });

  return { system, user };
}

/** Fix/remove/retag/redraw existing marks only — no additions. */
export function buildAuditCleanPrompt(params: {
  tags: string[];
  taggedChunkText: string;
  before: string;
  after: string;
  /** Override shipped audit-clean.system.txt task body. */
  auditCleanTaskText?: string;
}): { system: string; user: string } {
  return buildTaggedChunkPrompt(auditCleanSystemTemplate, {
    ...params,
    taskText: params.auditCleanTaskText,
  });
}

/** Find missed mentions in plain text only — add action only. */
export function buildAuditAddPrompt(params: {
  tags: string[];
  taggedChunkText: string;
  before: string;
  after: string;
}): { system: string; user: string } {
  return buildTaggedChunkPrompt(auditAddSystemTemplate, params);
}

/** JSON schema shared by suggest/audit responses — `action` defaults are enforced by each producer, not the schema. */
export function suggestionResponseSchema(actions: string[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            surface: { type: 'string' },
            occurrence: { type: 'integer' },
            tag: { type: 'string' },
            action: { type: 'string', enum: actions },
            confidence: { type: 'number' },
            rationale: { type: 'string' },
          },
          required: ['surface', 'occurrence', 'tag', 'action', 'confidence', 'rationale'],
          additionalProperties: false,
        },
      },
    },
    required: ['suggestions'],
    additionalProperties: false,
  };
}
