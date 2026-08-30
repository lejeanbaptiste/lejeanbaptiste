import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getCachedPluginHostSnapshot, resolveDevPluginSourcePath } from './plugins/pluginHost';

export const daozangCacheRoot = (): string => path.join(app.getPath('userData'), 'daozang-cache');

export const bundledDaozangCorpusRoot = (): string | null => {
  const candidates: string[] = [];
  const dev = resolveDevPluginSourcePath('daozang-import');
  if (dev) candidates.push(path.join(dev, 'data', 'corpus'));
  const plugin = getCachedPluginHostSnapshot()?.plugins.find((p) => p.id === 'daozang-import');
  if (plugin?.installPath) candidates.push(path.join(plugin.installPath, 'data', 'corpus'));
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'index.json')) &&
      fs.existsSync(path.join(candidate, 'utf8'))
    ) {
      return candidate;
    }
  }
  return null;
};

/**
 * The corpus shipped inside the plugin; a cache left by an older build of the plugin,
 * which installed the corpus separately, is used only if the bundle is missing.
 */
export const activeDaozangCorpusRoot = (): string => {
  const bundled = bundledDaozangCorpusRoot();
  if (bundled) return bundled;
  return daozangCacheRoot();
};

const daozangUtf8Root = (): string => path.join(activeDaozangCorpusRoot(), 'utf8');

export const daozangIndexPath = (): string => path.join(activeDaozangCorpusRoot(), 'index.json');

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
