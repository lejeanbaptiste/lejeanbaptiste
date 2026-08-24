/**
 * @jest-environment node
 *
 * Opt-in live harness — runs the real (dictionary-driven, non-AI) authority
 * tag bomb against a hand-tagged gold document, then scores whether AI
 * validate's confidence correctly cleans up its output. Complements
 * validationCalibration.live.test.ts (which uses AI suggest as the
 * candidate source, not the tag bomb) and authorityTagBombHarness.live.test.ts
 * (which scores tag-bomb span-finding recall, not validate's confidence).
 *
 * Specifically reports same-span alternatives — spans where the tag bomb
 * offered more than one tag for the same text (e.g. 將軍 as both roleName
 * and placeName) — and whether validate's confidence ranked the correct
 * tag above the wrong one. That's the concrete "did it clean up the tag
 * bomb" question.
 *
 * Requires compiled packs on disk (not run in CI by default).
 *
 * Example (local Ollama, offices+places packs only — fast):
 *   AUTHORITY_LIVE_TEST=1 \
 *   LLM_LIVE_BASE_URL=http://localhost:11434 \
 *   LLM_LIVE_MODEL=ministral-3:latest \
 *   AUTHORITY_ENTITY_DB_FOLDER=/path/to/folder-with-authority-packs \
 *   AUTHORITY_LIVE_PACKS=cbdb-offices,cbdb-places,chgis-places,dila-places \
 *   AUTHORITY_LIVE_TAGS=placeName,roleName \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=authorityTagBombCalibration.live.test
 *
 * Override gold file:
 *   AUTHORITY_LIVE_GOLD=/path/to/gold.xml
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import type { AuthorityPackId } from './packPaths';
import { packPath } from './packPaths';
import { normalizeDomText } from './normalize';
import { hostedApiKeyHelp, resolveLiveClientConfig } from './liveTestEnv';
import { MistralLlmClient, OllamaLlmClient, type LlmClient } from './llmClient';
import {
  runAuthorityTagBombCalibrationHarness,
  type ThresholdConfusion,
} from './validationCalibration';

const DOM_GLOBALS = ['NodeFilter', 'Node', 'Text', 'Element', 'Document', 'DOMParser'] as const;

function installDomGlobals(
  window: Record<(typeof DOM_GLOBALS)[number], unknown>,
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

function buildLiveClient(baseUrl: string, model: string, apiKey: string): LlmClient {
  if (baseUrl.includes(':11434')) {
    return new OllamaLlmClient({ baseUrl, model });
  }
  return new MistralLlmClient({ apiKey: apiKey || 'not-needed-for-local-server', model, baseUrl });
}

const RUN_LIVE = process.env.AUTHORITY_LIVE_TEST === '1';
const maybe = RUN_LIVE ? it : it.skip;

const repoRoot = path.resolve(__dirname, '../../../..');
const defaultGold = path.join(repoRoot, 'test_project/project/gold_test.xml');
const defaultEntityDbFolder = path.join(repoRoot, 'test_project');

const xmlPath = process.env.AUTHORITY_LIVE_GOLD ?? defaultGold;
const entityDbFolder = process.env.AUTHORITY_ENTITY_DB_FOLDER ?? defaultEntityDbFolder;
const packIds = (process.env.AUTHORITY_LIVE_PACKS ?? 'cbdb-offices,cbdb-places,chgis-places,dila-places')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as AuthorityPackId[];
const tags = (process.env.AUTHORITY_LIVE_TAGS ?? 'placeName,roleName')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const threshold = process.env.LLM_LIVE_THRESHOLD ? Number(process.env.LLM_LIVE_THRESHOLD) : 0.8;
const validateBatchSize = process.env.LLM_LIVE_VALIDATE_BATCH_SIZE
  ? Number(process.env.LLM_LIVE_VALIDATE_BATCH_SIZE)
  : undefined;
const excludeEditorialNotes = process.env.AUTHORITY_EXCLUDE_EDITOR_NOTES !== '0';

function formatConfusion(c: ThresholdConfusion): string {
  return `t=${c.threshold.toFixed(2)} acc=${c.accuracy.toFixed(3)} P=${c.precision.toFixed(3)} R=${c.recall.toFixed(3)} (tp=${c.tp} fp=${c.fp} tn=${c.tn} fn=${c.fn})`;
}

describe('authority tag bomb -> AI validate calibration (opt-in live)', () => {
  maybe('scores AI validate cleaning up real tag-bomb output vs hand-tagged gold', async () => {
    expect(fs.existsSync(xmlPath)).toBe(true);
    for (const packId of packIds) {
      expect(fs.existsSync(packPath(entityDbFolder, packId))).toBe(true);
    }

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

    const readPackFile = async (packId: AuthorityPackId) =>
      fs.readFileSync(packPath(entityDbFolder, packId), 'utf-8');

    const report = await runAuthorityTagBombCalibrationHarness(doc, {
      policy: 'ignore',
      tags,
      packIds,
      readPackFile,
      validateClient: client,
      autoAcceptThreshold: threshold,
      validateBatchSize,
      excludeEditorialNotes,
    });

    const bucketLines = report.buckets
      .filter((b) => b.count > 0)
      .map((b) => `    ${b.rangeLabel}: n=${b.count} accuracy=${b.accuracy.toFixed(3)} avgConfidence=${b.avgConfidence.toFixed(3)}`);

    const sameSpanLines = report.sameSpanGroups.map((g) => {
      const optionsStr = g.options
        .map((o) => `${o.tag}${o.correct ? '✓' : '✗'}=${o.confidence.toFixed(2)}`)
        .join(' vs ');
      const verdict = g.rankedCorrectHighest === null ? 'n/a (no correct option)' : g.rankedCorrectHighest ? 'RANKED CORRECTLY' : 'MISRANKED';
      return `    "${g.surface}"@${g.occurrence}: ${optionsStr} -> ${verdict}`;
    });

     
    console.log(
      [
        '',
        '── authority tag bomb -> validate calibration (live) ──────',
        `  gold file:        ${xmlPath}`,
        `  entity db folder: ${entityDbFolder}`,
        `  pack ids:         ${packIds.join(', ')}`,
        `  editorial notes:  ${excludeEditorialNotes ? 'excluded' : 'included'}`,
        `  tags scored:      ${tags.join(', ')}`,
        `  base URL:         ${baseUrl}`,
        `  model:            ${client.modelId}`,
        `  api key:          ${keySource}${apiKey ? ` (${apiKey.length} chars)` : ''}`,
        `  candidates loaded: ${report.candidateCount}`,
        `  tag-bomb matches:  ${report.matchCount}`,
        `  suggestions:       ${report.suggestCount}  (correct=${report.correctCount}, incorrect=${report.incorrectCount}, unvalidated=${report.unvalidatedCount})`,
        `  at threshold:      ${formatConfusion(report.atConfiguredThreshold)}`,
        '  calibration buckets:',
        ...bucketLines,
        '  threshold sweep:',
        ...report.sweep.map((c) => `    ${formatConfusion(c)}`),
        `  same-span alternatives (${report.sameSpanSummary.groupCount} groups, ${report.sameSpanSummary.decidableCount} decidable, accuracy=${report.sameSpanSummary.accuracy.toFixed(3)}):`,
        ...sameSpanLines,
        '─────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    expect(report.candidateCount).toBeGreaterThan(0);
  }, 600_000);
});
