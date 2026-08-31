import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { CANON_ORDER } from './cbetaCanonOrder';
import { invokePluginPythonSetup } from './pluginPythonBridge';
import { getCachedPluginHostSnapshot, resolveDevPluginSourcePath } from './plugins/pluginHost';

const corpusRel = path.join('data', 'corpus', 'xml-p5');

export const cbetaCorpusIsPresent = (root: string): boolean => {
  if (!fs.existsSync(root)) return false;
  return CANON_ORDER.some((canon) => fs.existsSync(path.join(root, canon)));
};

export const bundledCbetaCorpusCandidates = (): string[] => {
  const candidates: string[] = [];
  const dev = resolveDevPluginSourcePath('cbeta-import');
  if (dev) candidates.push(path.join(dev, corpusRel));
  const plugin = getCachedPluginHostSnapshot()?.plugins.find((p) => p.id === 'cbeta-import');
  if (plugin?.installPath) candidates.push(path.join(plugin.installPath, corpusRel));
  return candidates;
};

export const activeCbetaCorpusRoot = (): string | null => {
  for (const candidate of bundledCbetaCorpusCandidates()) {
    if (cbetaCorpusIsPresent(candidate)) return candidate;
  }
  const legacy = path.join(
    app.getPath('userData'),
    'plugin-cache',
    'cbeta-import',
    'corpus',
    'xml-p5',
  );
  if (cbetaCorpusIsPresent(legacy)) return legacy;
  return null;
};

export const cbetaCorpusStatus = (): {
  present: boolean;
  path: string | null;
  source: 'bundled' | 'legacy-cache' | 'none';
} => {
  const root = activeCbetaCorpusRoot();
  if (!root) {
    const target = bundledCbetaCorpusCandidates()[0] ?? defaultCbetaCorpusTarget();
    return { present: false, path: target, source: 'none' };
  }
  const legacyPrefix = path.join(app.getPath('userData'), 'plugin-cache');
  const source = root.startsWith(legacyPrefix) ? 'legacy-cache' : 'bundled';
  return { present: true, path: root, source };
};

/** Where a fresh git clone will land (install tree, not plugin-cache). */
export const defaultCbetaCorpusTarget = (): string => {
  const dev = resolveDevPluginSourcePath('cbeta-import');
  if (dev) return path.join(dev, corpusRel);
  return path.join(app.getPath('userData'), 'plugins', 'cbeta-import', corpusRel);
};

let ensurePromise: Promise<{ present: boolean; action?: string }> | null = null;

/** Clone xml-p5 when missing. Safe to call from install, enable, or dialog open. */
export const ensureCbetaCorpus = async (): Promise<{ present: boolean; action?: string }> => {
  if (cbetaCorpusStatus().present) return { present: true };

  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        const result = (await invokePluginPythonSetup('cbeta-import', { op: 'sync' })) as {
          action?: string;
        };
        return { present: cbetaCorpusStatus().present, action: result.action };
      } catch (error) {
        console.warn('[cbeta-corpus] ensure failed:', error);
        return { present: cbetaCorpusStatus().present };
      } finally {
        ensurePromise = null;
      }
    })();
  }
  return ensurePromise;
};

export const ensureCbetaCorpusInBackground = (): void => {
  if (cbetaCorpusStatus().present) return;
  void ensureCbetaCorpus();
};
