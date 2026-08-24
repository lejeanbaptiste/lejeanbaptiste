/**
 * @jest-environment node
 *
 * Opt-in live calibration harness — runs suggest against a hand-tagged gold
 * document (producing a natural mix of right and wrong candidates), then
 * scores whether the validation prompt's confidence actually separates them.
 * This is the harness to run while tuning validation.system.txt / the
 * confidence wording in llmValidationRank.ts's buildValidationUserPrompt —
 * not run by default. Node env gives native fetch; jsdom parses XML and
 * supplies DOM globals the autoTagging code expects.
 *
 * Local Ollama example (native /api/chat, structured-output schema):
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_BASE_URL=http://localhost:11434 \
 *   LLM_LIVE_MODEL=ministral-3-8b \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=validationCalibration.live.test
 *
 * Local LM Studio (OpenAI-compatible) example:
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_BASE_URL=http://localhost:1234 \
 *   LLM_LIVE_MODEL=mistralai/ministral-3-8b \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=validationCalibration.live.test
 *
 * Mistral/Groq hosted examples: same env vars as validationHarness.live.test.ts.
 *
 * Override gold file:
 *   LLM_LIVE_GOLD=/path/to/other.xml
 *
 * Override the auto-accept threshold being evaluated:
 *   LLM_LIVE_THRESHOLD=0.75
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { hostedApiKeyHelp, resolveLiveClientConfig } from './liveTestEnv';
import { MistralLlmClient, OllamaLlmClient, type LlmClient } from './llmClient';
import { normalizeDomText } from './normalize';
import { runValidationCalibrationHarness, type ThresholdConfusion } from './validationCalibration';

const DOM_GLOBALS = ['NodeFilter', 'Node', 'Text', 'Element', 'Document', 'DOMParser'] as const;

function installDomGlobals(window: Record<(typeof DOM_GLOBALS)[number], unknown>): void {
  for (const key of DOM_GLOBALS) {
    (globalThis as Record<string, unknown>)[key] = window[key];
  }
}

function parseGoldXml(source: string): Document {
  const dom = new JSDOM(source, { contentType: 'application/xml' });
  installDomGlobals(dom.window);
  return dom.window.document;
}

/** Ollama's native /api/chat endpoint (port 11434) needs OllamaLlmClient; everything else speaks OpenAI-style chat completions. */
function buildLiveClient(baseUrl: string, model: string, apiKey: string): LlmClient {
  if (baseUrl.includes(':11434')) {
    return new OllamaLlmClient({ baseUrl, model });
  }
  return new MistralLlmClient({ apiKey: apiKey || 'not-needed-for-local-server', model, baseUrl });
}

const RUN_LIVE = process.env.LLM_LIVE_TEST === '1';
const maybe = RUN_LIVE ? it : it.skip;

const defaultGold = path.resolve(__dirname, '../../../../test_project/project/gold_test.xml');
const xmlPath = process.env.LLM_LIVE_GOLD ?? defaultGold;
const threshold = process.env.LLM_LIVE_THRESHOLD ? Number(process.env.LLM_LIVE_THRESHOLD) : 0.8;

function formatConfusion(c: ThresholdConfusion): string {
  return `t=${c.threshold.toFixed(2)} acc=${c.accuracy.toFixed(3)} P=${c.precision.toFixed(3)} R=${c.recall.toFixed(3)} (tp=${c.tp} fp=${c.fp} tn=${c.tn} fn=${c.fn})`;
}

describe('validation calibration harness against a live model (opt-in)', () => {
  maybe(
    'scores validation confidence vs hand-tagged gold correctness',
    async () => {
      expect(fs.existsSync(xmlPath)).toBe(true);

      const { baseUrl, model, key: apiKey, keySource } = resolveLiveClientConfig();
      const needsKey =
        baseUrl.includes('api.mistral.ai') ||
        baseUrl.includes('groq.com') ||
        (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1'));
      if (needsKey && !apiKey) {
        throw new Error(hostedApiKeyHelp(baseUrl));
      }

      const client = buildLiveClient(baseUrl, model, apiKey);

      const source = fs.readFileSync(xmlPath, 'utf-8');
      const doc = parseGoldXml(source);
      normalizeDomText(doc);

      const tags = ['persName', 'placeName'];

      const report = await runValidationCalibrationHarness(doc, {
        policy: 'ignore',
        tags,
        suggestClient: client,
        targetChars: 800,
        marginChars: 100,
        autoAcceptThreshold: threshold,
      });

      const bucketLines = report.buckets
        .filter((b) => b.count > 0)
        .map(
          (b) =>
            `    ${b.rangeLabel}: n=${b.count} accuracy=${b.accuracy.toFixed(3)} avgConfidence=${b.avgConfidence.toFixed(3)}`,
        );

      console.log(
        [
          '',
          '── validation calibration harness (live) ──────────────────',
          `  gold file:        ${xmlPath}`,
          `  base URL:         ${baseUrl}`,
          `  model:            ${client.modelId}`,
          `  api key:          ${keySource}${apiKey ? ` (${apiKey.length} chars)` : ''}`,
          `  suggestions:      ${report.suggestCount}  (correct=${report.correctCount}, incorrect=${report.incorrectCount}, unvalidated=${report.unvalidatedCount})`,
          `  at threshold:     ${formatConfusion(report.atConfiguredThreshold)}`,
          '  calibration buckets:',
          ...bucketLines,
          '  threshold sweep:',
          ...report.sweep.map((c) => `    ${formatConfusion(c)}`),
          '─────────────────────────────────────────────────────────',
        ].join('\n'),
      );

      expect(report.suggestCount).toBeGreaterThan(0);
    },
    600_000,
  );
});
