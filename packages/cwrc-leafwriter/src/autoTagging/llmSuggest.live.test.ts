/**
 * @jest-environment node
 *
 * Manual, opt-in live test against a real model server (Groq, LM Studio,
 * Ollama, hosted Mistral). Not run by default.
 *
 * Groq (uses GROQ_API_KEY from your shell):
 *   export GROQ_API_KEY=gsk_...
 *   LLM_LIVE_TEST=1 LLM_LIVE_BASE_URL=https://api.groq.com/openai LLM_LIVE_MODEL=qwen/qwen3-32b \
 *     NODE_OPTIONS=--no-experimental-strip-types npx jest --selectProjects Core --testPathPatterns=llmSuggest.live.test
 *
 * Local LM Studio:
 *   LLM_LIVE_TEST=1 LLM_LIVE_BASE_URL=http://localhost:1234 LLM_LIVE_MODEL=mistralai/ministral-3-8b \
 *     NODE_OPTIONS=--no-experimental-strip-types npx jest --selectProjects Core --testPathPatterns=llmSuggest.live.test
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { resolveLiveClientConfig } from './liveTestEnv';
import { MistralLlmClient } from './llmClient';
import { llmSuggest } from './llmSuggest';
import { normalizeDomText } from './normalize';

const DOM_GLOBALS = ['NodeFilter', 'Node', 'Text', 'Element', 'Document', 'DOMParser'] as const;

function installDomGlobals(
  window: { [K in (typeof DOM_GLOBALS)[number]]: unknown },
): void {
  for (const key of DOM_GLOBALS) {
    (globalThis as Record<string, unknown>)[key] = window[key];
  }
}

function parseGoldXml(source: string): Document {
  const dom = new JSDOM(source, { contentType: 'application/xml' });
  installDomGlobals(dom.window);
  return dom.window.document;
}

const RUN_LIVE = process.env.LLM_LIVE_TEST === '1';
const maybe = RUN_LIVE ? it : it.skip;

const xmlPath = path.resolve(__dirname, '../../../../test_project/corpus_a/sizhu_shang.xml');

describe('llmSuggest against a live local model (opt-in)', () => {
  maybe('finds persName/placeName mentions in a real chunk of the corpus', async () => {
    expect(fs.existsSync(xmlPath)).toBe(true);
    const source = fs.readFileSync(xmlPath, 'utf-8');
    const doc = parseGoldXml(source);
    normalizeDomText(doc);

    const { baseUrl, model, key: apiKey } = resolveLiveClientConfig();

    const client = new MistralLlmClient({
      apiKey: apiKey || 'not-needed-for-local-server',
      model,
      baseUrl,
    });

    const result = await llmSuggest(doc, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      client,
      targetChars: 800,
      marginChars: 100,
    });

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '── llmSuggest live test (local model) ──────────────────',
        `  model:            ${client.modelId}`,
        `  suggestions:      ${result.suggestions.length}`,
        `  unverifiable:     ${result.unverifiableCount}`,
        ...result.suggestions
          .slice(0, 15)
          .map((s) => `    ${s.tag.padEnd(10)} "${s.anchor.surface}" (conf ${s.confidence}) — ${s.rationale}`),
        '─────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    expect(result.suggestions.length).toBeGreaterThan(0);
    for (const s of result.suggestions) {
      expect(['persName', 'placeName']).toContain(s.tag);
      expect(s.status).toBe('pending');
      expect(s.source).toBe('ai');
    }
  }, 120_000);
});
