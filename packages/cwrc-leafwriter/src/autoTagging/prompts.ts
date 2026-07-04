/**
 * Assembles LLM prompts from editable templates in `./prompt-templates/`.
 * Bump versions in `prompt-templates/versions.json` when semantics change —
 * the version string is part of the LLM cache key (see llmCache.ts).
 */

import auditSystemTemplate from './prompt-templates/audit.system.txt';
import preambleTemplate from './prompt-templates/preamble.txt';
import suggestSystemTemplate from './prompt-templates/suggest.system.txt';
import tagDefinitions from './prompt-templates/tag-definitions.json';
import userWrapperTemplate from './prompt-templates/user.wrapper.txt';
import versions from './prompt-templates/versions.json';

export const SUGGEST_PROMPT_VERSION = versions.suggest;
export const AUDIT_PROMPT_VERSION = versions.audit;

const TAG_DEFINITIONS: Record<string, string> = tagDefinitions;

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
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
}): { system: string; user: string } {
  const tagGuide = buildSuggestTagGuide(params.tags);
  const system = `${preambleTemplate}${fillTemplate(suggestSystemTemplate, {
    TAGS: params.tags.join(', '),
    TAG_GUIDE: tagGuide,
  })}`;

  const user = fillTemplate(userWrapperTemplate, {
    BEFORE: params.before,
    CHUNK: params.chunkText,
    AFTER: params.after,
  });

  return { system, user };
}

/**
 * Audit operates on a chunk that already carries tags (rendered as inline
 * markers below) and proposes corrections. Action vocabulary mirrors the
 * shared Suggestion type: keep (no suggestion emitted), add (missed
 * mention), remove (false positive), retag (wrong tag name), or
 * redraw-boundary (right idea, wrong span).
 */
export function buildAuditPrompt(params: {
  tags: string[];
  taggedChunkText: string;
  before: string;
  after: string;
}): { system: string; user: string } {
  const system = `${preambleTemplate}${fillTemplate(auditSystemTemplate, {
    TAGS: params.tags.join(', '),
  })}`;

  const user = fillTemplate(userWrapperTemplate, {
    BEFORE: params.before,
    CHUNK: params.taggedChunkText,
    AFTER: params.after,
  });

  return { system, user };
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
