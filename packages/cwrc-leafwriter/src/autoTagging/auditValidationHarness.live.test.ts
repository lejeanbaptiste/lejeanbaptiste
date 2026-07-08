/**
 * @jest-environment node
 *
 * Opt-in live audit harness — scores AI audit on auto-tagged XML against
 * hand-tagged manual.xml gold. This is the realistic tuning loop: you tag
 * one file by hand, run auto-tagging on a copy, then measure whether audit
 * moves auto.xml closer to manual.xml.
 *
 * Defaults (gitignored test_project):
 *   test_project/project/gold_test/manual.xml  — hand gold
 *   test_project/project/gold_test/auto.xml    — auto-tagged input
 *
 * Groq example:
 *   export GROQ_API_KEY=gsk_...
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_MODEL=qwen/qwen3.6-27b \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=auditValidationHarness.live.test
 *
 * Override paths:
 *   LLM_LIVE_MANUAL=/path/to/manual.xml
 *   LLM_LIVE_AUTO=/path/to/auto.xml
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { hostedApiKeyHelp, resolveLiveClientConfig } from './liveTestEnv';
import { MistralLlmClient } from './llmClient';
import { normalizeDomText } from './normalize';
import { goldMentionsForAutoCorpus, runManualAutoAuditHarness } from './validationHarness';

const DOM_GLOBALS = ['NodeFilter', 'Node', 'Text', 'Element', 'Document', 'DOMParser', 'XMLSerializer'] as const;

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

const goldDir = path.resolve(__dirname, '../../../../test_project/project/gold_test');
const manualPath = process.env.LLM_LIVE_MANUAL ?? path.join(goldDir, 'manual.xml');
const autoPath = process.env.LLM_LIVE_AUTO ?? path.join(goldDir, 'auto.xml');

function formatMetrics(m: { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number }): string {
  return `P=${m.precision.toFixed(3)} R=${m.recall.toFixed(3)} F1=${m.f1.toFixed(3)} (tp=${m.tp} fp=${m.fp} fn=${m.fn})`;
}

describe('audit validation harness against a live model (opt-in)', () => {
  maybe('scores audit on auto.xml vs manual.xml gold', async () => {
    expect(fs.existsSync(manualPath)).toBe(true);
    expect(fs.existsSync(autoPath)).toBe(true);

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

    const manualDoc = parseGoldXml(fs.readFileSync(manualPath, 'utf-8'));
    const autoDoc = parseGoldXml(fs.readFileSync(autoPath, 'utf-8'));
    normalizeDomText(manualDoc);
    normalizeDomText(autoDoc);

    const tags = ['persName', 'placeName'];
    const { gold, corpusTextMatch, goldSkipped } = goldMentionsForAutoCorpus(
      manualDoc,
      autoDoc,
      'ignore',
      tags,
    );

    const report = await runManualAutoAuditHarness(manualDoc, autoDoc, {
      policy: 'ignore',
      tags,
      client,
      targetChars: 800,
      marginChars: 100,
    });

    const deltaF1 = report.overall.f1 - report.beforeAudit.overall.f1;

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '── audit validation harness (live) ───────────────────────',
        `  manual (gold):    ${manualPath}`,
        `  auto (input):     ${autoPath}`,
        `  corpus text match:${corpusTextMatch ? ' yes' : ' NO — scores may be unreliable'}`,
        `  base URL:         ${baseUrl}`,
        `  model:            ${client.modelId}`,
        `  api key:          ${keySource}${apiKey ? ` (${apiKey.length} chars)` : ''}`,
        `  gold mentions:    ${report.goldCount}  (${goldSkipped} skipped, ${gold.length} in manual)`,
        `  before audit:     ${formatMetrics(report.beforeAudit.overall)}`,
        `  after audit:      ${formatMetrics(report.overall)}`,
        `  delta F1:         ${deltaF1 >= 0 ? '+' : ''}${deltaF1.toFixed(3)}`,
        `  audit findings:   ${report.auditSuggestionCount} (${report.auditUnverifiableCount} unverifiable)`,
        `  clean / add:      ${report.cleanSuggestionCount} / ${report.addSuggestionCount}`,
        `  persName (after): ${report.byTag.persName ? formatMetrics(report.byTag.persName) : 'n/a'}`,
        `  placeName (after):${report.byTag.placeName ? formatMetrics(report.byTag.placeName) : 'n/a'}`,
        '─────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    expect(report.goldCount).toBeGreaterThan(0);
  }, 1_200_000);
});
