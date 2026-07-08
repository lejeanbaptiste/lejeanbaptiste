/**
 * @jest-environment node
 *
 * Opt-in live validation — scores authority tag bomb against a hand-tagged
 * gold document. Requires compiled packs on disk (not run in CI by default).
 *
 * Example (Eastern Han filter, DILA persons):
 *   AUTHORITY_LIVE_TEST=1 \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=authorityTagBombHarness.live.test
 *
 * Override paths:
 *   AUTHORITY_LIVE_GOLD=/path/to/gold.xml
 *   AUTHORITY_ENTITY_DB_FOLDER=/path/to/folder-with-authority-packs
 *   AUTHORITY_LIVE_PACKS=dila-persons,dila-places
 *   AUTHORITY_YEAR_START=25 AUTHORITY_YEAR_END=220
 *   AUTHORITY_HIDE_UNDATED=1
 *   AUTHORITY_LIVE_TAGS=persName,placeName,roleName
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import type { AuthorityPackId } from './packPaths';
import { packPath } from './packPaths';
import { normalizeDomText } from './normalize';
import { goldMentions, runAuthorityTagBombHarness } from './validationHarness';

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

const RUN_LIVE = process.env.AUTHORITY_LIVE_TEST === '1';
const maybe = RUN_LIVE ? it : it.skip;

const repoRoot = path.resolve(__dirname, '../../../..');
const defaultGold = path.join(repoRoot, 'test_project/project/gold_test.xml');
const defaultEntityDbFolder = path.join(repoRoot, 'test_project');

const xmlPath = process.env.AUTHORITY_LIVE_GOLD ?? defaultGold;
const entityDbFolder = process.env.AUTHORITY_ENTITY_DB_FOLDER ?? defaultEntityDbFolder;
const packIds = (process.env.AUTHORITY_LIVE_PACKS ?? 'dila-persons')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as AuthorityPackId[];
const tags = (process.env.AUTHORITY_LIVE_TAGS ?? 'persName')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const yearStart = process.env.AUTHORITY_YEAR_START
  ? Number.parseInt(process.env.AUTHORITY_YEAR_START, 10)
  : 25;
const yearEnd = process.env.AUTHORITY_YEAR_END
  ? Number.parseInt(process.env.AUTHORITY_YEAR_END, 10)
  : 220;
const hideUndated = process.env.AUTHORITY_HIDE_UNDATED !== '0';
const yearFilterEnabled = process.env.AUTHORITY_YEAR_FILTER !== '0';

function formatMetrics(m: {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}): string {
  return `P=${m.precision.toFixed(3)} R=${m.recall.toFixed(3)} F1=${m.f1.toFixed(3)} (tp=${m.tp} fp=${m.fp} fn=${m.fn})`;
}

describe('authority tag bomb validation harness (opt-in live)', () => {
  maybe('scores tag bomb vs hand-tagged gold', async () => {
    expect(fs.existsSync(xmlPath)).toBe(true);
    for (const packId of packIds) {
      expect(fs.existsSync(packPath(entityDbFolder, packId))).toBe(true);
    }

    const source = fs.readFileSync(xmlPath, 'utf-8');
    const doc = parseGoldXml(source);
    normalizeDomText(doc);

    const readPackFile = async (packId: AuthorityPackId) =>
      fs.readFileSync(packPath(entityDbFolder, packId), 'utf-8');

    const gold = goldMentions(doc, 'ignore', tags);
    const report = await runAuthorityTagBombHarness(doc, {
      policy: 'ignore',
      tags,
      packIds,
      readPackFile,
      ...(yearFilterEnabled
        ? { yearRange: { start: yearStart, end: yearEnd }, hideUndated }
        : {}),
    });

    // eslint-disable-next-line no-console -- live harness output
    console.log('\n--- authority tag bomb harness ---');
    console.log('gold file:', xmlPath);
    console.log('entity db folder:', entityDbFolder);
    console.log('pack ids:', packIds.join(', '));
    console.log('tags scored:', tags.join(', '));
    if (yearFilterEnabled) {
      console.log(`year filter: ${yearStart}–${yearEnd} CE, hideUndated=${hideUndated}`);
    } else {
      console.log('year filter: off');
    }
    console.log('gold mentions:', gold.length);
    console.log('candidates loaded:', report.candidateCount);
    console.log('matches:', report.matchCount);
    console.log('overall:', formatMetrics(report.overall));
    for (const [tag, metrics] of Object.entries(report.byTag)) {
      console.log(`  ${tag}: ${formatMetrics(metrics)}`);
    }
    if (report.wrongTag.length > 0) {
      console.log('wrong tag (first 10):', report.wrongTag.slice(0, 10));
    }
    if (report.overall.fn > 0) {
      const predictedKeys = new Set(
        report.wrongTag.map((w) => `${w.surface}@${w.occurrence}`),
      );
      const missed = gold.filter((g) => {
        const key = `${g.surface}@${g.occurrence}`;
        return !predictedKeys.has(key);
      });
      console.log('sample false negatives (first 15):', missed.slice(0, 15));
    }

    expect(report.goldCount).toBeGreaterThan(0);
    expect(report.candidateCount).toBeGreaterThan(0);
  }, 120_000);
});
