/**
 * @jest-environment node
 *
 * Opt-in live replay of cached disambiguation candidate sets through the
 * current LLM ranking prompt. Reads a project's `.ljb/disambiguation-pending.json`,
 * reconstructs matching mention groups from the project's XML files, and
 * prints how often the model selects candidates vs abstains.
 *
 * Example:
 *   export GROQ_API_KEY=gsk_...
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_MODEL=qwen/qwen3.6-27b \
 *   LLM_DISAMBIG_REPLAY_PROJECT=test_project/project \
 *   LLM_DISAMBIG_REPLAY_LIMIT=10 \
 *   NODE_OPTIONS=--no-experimental-strip-types \
 *   npx jest --selectProjects Core --testPathPatterns=disambiguationReplay.live.test
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { rankDisambiguationCandidates } from './llmDisambiguationRank';
import { hostedApiKeyHelp, resolveLiveClientConfig } from './liveTestEnv';
import { MistralLlmClient } from './llmClient';
import { collectMentions, mergeMentionGroups, type MentionGroup } from './mentions';
import { normalizeDomText } from './normalize';
import { parsePendingCache } from './disambiguationPending';

const DOM_GLOBALS = ['NodeFilter', 'Node', 'Text', 'Element', 'Document', 'DOMParser'] as const;

function installDomGlobals(
  window: { [K in (typeof DOM_GLOBALS)[number]]: unknown },
): void {
  for (const key of DOM_GLOBALS) {
    (globalThis as Record<string, unknown>)[key] = window[key];
  }
}

function parseXmlFile(filePath: string): Document {
  const source = fs.readFileSync(filePath, 'utf-8');
  const dom = new JSDOM(source, { contentType: 'application/xml' });
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  normalizeDomText(doc);
  return doc;
}

function listProjectXmlFiles(projectRoot: string): string[] {
  return fs
    .readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.xml') && entry.name !== 'entities.xml')
    .map((entry) => path.join(projectRoot, entry.name))
    .sort();
}

function collectProjectMentionGroups(projectRoot: string): MentionGroup[] {
  const files = listProjectXmlFiles(projectRoot);
  const groups: MentionGroup[] = [];
  for (const filePath of files) {
    const doc = parseXmlFile(filePath);
    groups.push(...collectMentions(doc, 'ignore', path.basename(filePath), { includeResolved: true }));
  }
  return mergeMentionGroups(groups);
}

type ReplayRow = {
  tag: string;
  surface: string;
  candidateCount: number;
  selectedCount: number;
  selectedIds: string[];
  hasRationale: boolean;
  suggestCreateNew: boolean;
};

const RUN_LIVE = process.env.LLM_LIVE_TEST === '1';
const maybe = RUN_LIVE ? it : it.skip;

const defaultProjectRoot = path.resolve(__dirname, '../../../../test_project/project');
const projectRoot = path.resolve(process.env.LLM_DISAMBIG_REPLAY_PROJECT ?? defaultProjectRoot);
const replayLimit = Math.max(1, Number(process.env.LLM_DISAMBIG_REPLAY_LIMIT ?? '10'));

describe('disambiguation replay against a live model (opt-in)', () => {
  maybe('replays cached pending candidates through the current AI ranker', async () => {
    expect(fs.existsSync(projectRoot)).toBe(true);
    const pendingPath = path.join(projectRoot, '.ljb', 'disambiguation-pending.json');
    expect(fs.existsSync(pendingPath)).toBe(true);

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

    const pending = parsePendingCache(fs.readFileSync(pendingPath, 'utf-8'));
    const mentionGroups = collectProjectMentionGroups(projectRoot);

    const rows: ReplayRow[] = [];
    const skipped: string[] = [];
    for (const entry of Object.values(pending.entries).slice(0, replayLimit)) {
      const group = mentionGroups.find((item) => item.tag === entry.tag && item.surface === entry.surface);
      const instance = group?.instances.find((item) => item.isUnresolved) ?? group?.instances[0];
      if (!group || !instance) {
        skipped.push(`${entry.tag}:${entry.surface}`);
        continue;
      }

      const xmlPath = path.join(projectRoot, instance.documentId);
      if (!fs.existsSync(xmlPath)) {
        skipped.push(`${entry.tag}:${entry.surface} (${instance.documentId})`);
        continue;
      }
      const doc = parseXmlFile(xmlPath);
      const result = await rankDisambiguationCandidates({
        doc,
        instance,
        candidates: entry.candidates,
        client,
      });
      if (!result) {
        rows.push({
          tag: entry.tag,
          surface: entry.surface,
          candidateCount: entry.candidates.length,
          selectedCount: 0,
          selectedIds: [],
          hasRationale: false,
          suggestCreateNew: false,
        });
        continue;
      }
      rows.push({
        tag: entry.tag,
        surface: entry.surface,
        candidateCount: entry.candidates.length,
        selectedCount: result.selectedCandidateIds.length,
        selectedIds: result.selectedCandidateIds,
        hasRationale: Object.keys(result.rationales).length > 0,
        suggestCreateNew: result.suggestCreateNew,
      });
    }

    const abstained = rows.filter((row) => row.selectedCount === 0 && !row.suggestCreateNew).length;
    const selected = rows.filter((row) => row.selectedCount > 0).length;
    const createNew = rows.filter((row) => row.suggestCreateNew).length;

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '── disambiguation replay (live) ─────────────────────────',
        `  project:          ${projectRoot}`,
        `  pending file:     ${pendingPath}`,
        `  base URL:         ${baseUrl}`,
        `  model:            ${client.modelId}`,
        `  api key:          ${keySource}${apiKey ? ` (${apiKey.length} chars)` : ''}`,
        `  replayed:         ${rows.length}`,
        `  skipped:          ${skipped.length}`,
        `  selected:         ${selected}`,
        `  abstained:        ${abstained}`,
        `  suggest-create:   ${createNew}`,
        '',
        ...rows.slice(0, 20).map(
          (row) =>
            `  ${row.tag}:${row.surface} | candidates=${row.candidateCount} | selected=${row.selectedCount} | create=${row.suggestCreateNew ? 'yes' : 'no'} | rationale=${row.hasRationale ? 'yes' : 'no'}${row.selectedIds.length ? ` | ids=${row.selectedIds.join(', ')}` : ''}`,
        ),
        ...(skipped.length
          ? ['', `  skipped samples: ${skipped.slice(0, 10).join(' ; ')}`]
          : []),
        '─────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    expect(rows.length).toBeGreaterThan(0);
  }, 600_000);
});
