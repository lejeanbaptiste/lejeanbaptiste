import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import {
  getCachedPluginHostSnapshot,
  resolveDevPluginSourcePath,
} from './plugins/pluginHost';

export const DAOZANG_ARCHIVE_NAME = 'DaoCanon_txt_chm.rar';

export interface DaozangLocalSource {
  path: string;
  label: string;
  kind: 'extracted' | 'rar';
}

export const daozangCacheRoot = (): string => path.join(app.getPath('userData'), 'daozang-cache');

export const bundledDaozangCorpusRoot = (): string | null => {
  const candidates: string[] = [];
  const dev = resolveDevPluginSourcePath('daozang-import');
  if (dev) candidates.push(path.join(dev, 'data', 'corpus'));
  const plugin = getCachedPluginHostSnapshot()?.plugins.find((p) => p.id === 'daozang-import');
  if (plugin?.installPath) candidates.push(path.join(plugin.installPath, 'data', 'corpus'));
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.json')) && fs.existsSync(path.join(candidate, 'utf8'))) {
      return candidate;
    }
  }
  return null;
};

/** User cache if installed; otherwise the corpus shipped inside the plugin. */
export const activeDaozangCorpusRoot = (): string => {
  const userIndex = path.join(daozangCacheRoot(), 'index.json');
  const userUtf8 = path.join(daozangCacheRoot(), 'utf8');
  if (fs.existsSync(userIndex) && fs.existsSync(userUtf8)) return daozangCacheRoot();
  const bundled = bundledDaozangCorpusRoot();
  if (bundled) return bundled;
  return daozangCacheRoot();
};

export const daozangUtf8Root = (): string => path.join(activeDaozangCorpusRoot(), 'utf8');

export const daozangIndexPath = (): string => path.join(activeDaozangCorpusRoot(), 'index.json');

export const daozangManifestPath = (): string => path.join(activeDaozangCorpusRoot(), 'manifest.json');

export const daozangTextPath = (relPath: string): string =>
  path.join(daozangUtf8Root(), relPath.replace(/^\/+/, ''));

export const daozangCorpusStatus = (): {
  ready: boolean;
  textCount: number;
  source: 'user-cache' | 'bundled' | 'none';
  manifest: Record<string, unknown>;
  cacheRoot: string;
} => {
  const root = activeDaozangCorpusRoot();
  const indexPath = path.join(root, 'index.json');
  const utf8Root = path.join(root, 'utf8');
  const manifestPath = path.join(root, 'manifest.json');
  const ready = fs.existsSync(indexPath) && fs.existsSync(utf8Root);
  let manifest: Record<string, unknown> = {};
  let textCount = 0;
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    textCount = Number(manifest.textCount) || 0;
  }
  if (ready && textCount === 0) {
    textCount = (JSON.parse(fs.readFileSync(indexPath, 'utf8')) as unknown[]).length;
  }
  const source =
    ready && root === daozangCacheRoot()
      ? 'user-cache'
      : ready && root === bundledDaozangCorpusRoot()
        ? 'bundled'
        : 'none';
  return { ready, textCount, source, manifest, cacheRoot: root };
};

const downloadDirs = (): string[] =>
  [...new Set([app.getPath('downloads'), path.join(os.homedir(), 'Downloads')])];

/** Prefer an already-extracted txt tree, then complete local RAR archives. */
export const detectDaozangLocalSources = (): DaozangLocalSource[] => {
  const found: DaozangLocalSource[] = [];
  const seen = new Set<string>();

  const push = (candidate: DaozangLocalSource) => {
    const key = candidate.path.replace(/\\/g, '/');
    if (seen.has(key) || !fs.existsSync(candidate.path)) return;
    seen.add(key);
    found.push(candidate);
  };

  for (const dir of downloadDirs()) {
    const extractedTxt = path.join(dir, 'DaoCanon_txt_chm', '道藏_txt');
    if (fs.existsSync(extractedTxt) && fs.statSync(extractedTxt).isDirectory()) {
      push({
        path: extractedTxt,
        label: 'Extracted texts (道藏_txt)',
        kind: 'extracted',
      });
    }

    for (const name of ['DaoCanon_txt_chm.rar', 'DaoCanon_txt_chm-2.rar', DAOZANG_ARCHIVE_NAME]) {
      const rarPath = path.join(dir, name);
      if (fs.existsSync(rarPath) && fs.statSync(rarPath).isFile()) {
        push({
          path: rarPath,
          label: path.basename(rarPath),
          kind: 'rar',
        });
      }
    }
  }

  return found.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'extracted' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
};
