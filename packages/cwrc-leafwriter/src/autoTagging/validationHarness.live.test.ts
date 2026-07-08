/**
 * @jest-environment node
 *
 * Opt-in live validation harness — scores AI suggest against a hand-tagged
 * gold document. Not run by default. Node env gives native fetch; jsdom
 * parses XML and supplies DOM globals the autoTagging code expects.
 *
 * Mistral hosted API example:
 *   export MISTRAL_API_KEY=...
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_BASE_URL=https://api.mistral.ai \
 *   LLM_LIVE_MODEL=ministral-8b-2512 \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test
 *
 * Groq example (GROQ_API_KEY auto-detected; defaults to Groq if both keys exported):
 *   export GROQ_API_KEY=gsk_...
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_MODEL=qwen/qwen3-32b \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test
 *
 * Mistral hosted (when both GROQ_API_KEY and MISTRAL_API_KEY are exported):
 *   LLM_LIVE_TEST=1 LLM_LIVE_MODEL=ministral-8b-2512 \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test
 *
 * Local LM Studio example:
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_BASE_URL=http://localhost:1234 \
 *   LLM_LIVE_MODEL=mistralai/ministral-3-8b \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test
 *
 * Override gold file:
 *   LLM_LIVE_GOLD=/path/to/other.xml
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { hostedApiKeyHelp, resolveLiveClientConfig } from './liveTestEnv';
import { MistralLlmClient } from './llmClient';
import { normalizeDomText } from './normalize';
import { goldMentions, runValidationHarness } from './validationHarness';

const DOM_GLOBALS = ['NodeFilter', 'Node', 'Text', 'Element', 'Document', 'DOMParser'] as const;

/** Shared autoTagging code expects browser DOM globals; install from jsdom. */
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

const defaultGold = path.resolve(__dirname, '../../../../test_project/project/gold_test.xml');
const xmlPath = process.env.LLM_LIVE_GOLD ?? defaultGold;

function formatMetrics(m: { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number }): string {
  return `P=${m.precision.toFixed(3)} R=${m.recall.toFixed(3)} F1=${m.f1.toFixed(3)} (tp=${m.tp} fp=${m.fp} fn=${m.fn})`;
}

describe('validation harness against a live model (opt-in)', () => {
  maybe('scores suggest vs hand-tagged gold', async () => {
    expect(fs.existsSync(xmlPath)).toBe(true);

    const { baseUrl, model, key: apiKey, keySource } = resolveLiveClientConfig();
    const needsKey =
      baseUrl.includes('api.mistral.ai') ||
      baseUrl.includes('groq.com') ||
      (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1'));
    if (needsKey && !apiKey) {
      throw new Error(hostedApiKeyHelp(baseUrl));
    }

    const client = new MistralLlmClient({
      apiKey: apiKey || 'not-needed-for-local-server',
      model,
      baseUrl,
    });

    const source = fs.readFileSync(xmlPath, 'utf-8');
    const doc = parseGoldXml(source);
    normalizeDomText(doc);

    const tags = ['persName', 'placeName'];
    const gold = goldMentions(doc, 'ignore', tags);

    const report = await runValidationHarness(doc, {
      policy: 'ignore',
      tags,
      client,
      targetChars: 800,
      marginChars: 100,
    });

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '── validation harness (live) ─────────────────────────────',
        `  gold file:        ${xmlPath}`,
        `  base URL:         ${baseUrl}`,
        `  model:            ${client.modelId}`,
        `  api key:          ${keySource}${apiKey ? ` (${apiKey.length} chars)` : ''}`,
        `  gold mentions:    ${report.goldCount}  (pre-strip count: ${gold.length})`,
        `  predicted:        ${report.predictedCount}`,
        `  unverifiable:     ${report.unverifiableCount}`,
        `  overall:          ${formatMetrics(report.overall)}`,
        `  persName:         ${report.byTag.persName ? formatMetrics(report.byTag.persName) : 'n/a'}`,
        `  placeName:        ${report.byTag.placeName ? formatMetrics(report.byTag.placeName) : 'n/a'}`,
        `  wrong-tag:        ${report.wrongTag.length}`,
        '─────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    expect(report.goldCount).toBeGreaterThan(0);
  }, 600_000);
});
