/**
 * Subprocess bridge to the sanmiao Python package (`propose_dates` via tei_bridge CLI).
 */

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SANMIAO_TIMEOUT_MS = 5 * 60 * 1000;

export interface SanmiaoProposeOptions {
  civ?: string[];
  sequential?: boolean;
  fuzzy?: boolean;
  tpq?: number;
  taq?: number;
  pg?: boolean;
  lang?: string;
}

export interface SanmiaoCandidate {
  displayLine: string;
  attrs: Record<string, string>;
  era_id?: number | null;
  dyn_id?: number | null;
  error_str?: string | null;
}

export interface SanmiaoProposal {
  date_index: number;
  date_string: string;
  status: 'unique' | 'ambiguous' | 'unresolved' | 'tagged';
  candidates: SanmiaoCandidate[];
  attrs?: Record<string, string>;
  parseInnerXml?: string;
}

export type SanmiaoChunkProgress =
  | { type: 'init'; total: number; tablesMs: number }
  | {
      type: 'chunk';
      index: number;
      done: number;
      total: number;
      ms: number;
      chars: number;
      proposals: number;
      skipped: boolean;
    };

export type SanmiaoProgressCallback = (event: SanmiaoChunkProgress) => void;

/** Resolve sibling repo (dev) or bundled copy (packaged app). */
export const resolveSanmiaoRoot = (): string | null => {
  const candidates = [
    path.join(process.resourcesPath, 'sanmiao'),
    path.resolve(__dirname, '../../../../sanmiao'),
    path.resolve(process.cwd(), '../sanmiao'),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'src/sanmiao/tei_bridge.py'))) return root;
  }
  return null;
};

const pythonCandidates = (): string[] => {
  const fromEnv = process.env.SANMIAO_PYTHON?.trim();
  const root = resolveSanmiaoRoot();
  const venvPython =
    root && process.platform === 'win32'
      ? path.join(root, '.venv', 'Scripts', 'python.exe')
      : root
        ? path.join(root, '.venv', 'bin', 'python')
        : null;

  if (fromEnv) return [fromEnv];

  if (root && venvPython && fs.existsSync(venvPython)) {
    return [venvPython];
  }

  // Relocatable CPython shipped with the packaged app (macOS), deps preinstalled.
  const bundledPython = path.join(process.resourcesPath ?? '', 'python', 'bin', 'python3');
  if (process.resourcesPath && fs.existsSync(bundledPython)) {
    return [bundledPython, 'python3', 'python'];
  }

  return ['python3', 'python'];
};

let cachedPython: string | null | undefined;
let cachedDevRoot: string | null | undefined;

/**
 * Oldest sanmiao whose tei_bridge CLI speaks the {"mode": ...} protocol.
 * Older installs import fine but crash on the first tagDatesBatch call
 * (propose_dates() got an unexpected keyword argument 'mode').
 */
const MIN_SANMIAO_VERSION = '0.2.10';

const SANMIAO_IMPORT_CHECK = [
  'import re, sanmiao',
  'from sanmiao.tei_bridge import cli_main',
  `minimum = tuple(int(x) for x in "${MIN_SANMIAO_VERSION}".split("."))`,
  'found = tuple(int(x) for x in re.findall(r"\\d+", sanmiao.__version__)[:3])',
  'assert found >= minimum, f"sanmiao {sanmiao.__version__} is too old (need >= ' +
    MIN_SANMIAO_VERSION +
    ')"',
].join('; ');

const logSanmiao = (message: string, data?: Record<string, unknown>) => {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[sanmiao] ${message}${suffix}`);
};

/** First Python that can import sanmiao with tei_bridge (editable venv or pip). */
export const resolveSanmiaoPython = async (): Promise<string> => {
  if (cachedPython) return cachedPython;

  const root = resolveSanmiaoRoot();
  const failures: string[] = [];

  const recordFailure = (python: string, error: unknown) => {
    const stderr = (error as { stderr?: string })?.stderr ?? String(error);
    const assertion = stderr.match(/AssertionError: (.+)/)?.[1];
    const reason = assertion ?? stderr.trim().split('\n').pop() ?? 'unknown error';
    failures.push(`${python}: ${reason}`);
    logSanmiao('candidate rejected', { python, reason });
  };

  for (const python of pythonCandidates()) {
    try {
      await execFileAsync(python, ['-c', SANMIAO_IMPORT_CHECK], {
        timeout: 15_000,
        env: process.env,
      });
      cachedPython = python;
      cachedDevRoot = null;
      logSanmiao('using python', { python, root: root ?? undefined });
      return python;
    } catch (error) {
      recordFailure(python, error);
    }
  }

  if (root) {
    const env = { ...process.env, PYTHONPATH: path.join(root, 'src') };
    for (const python of ['python3', 'python']) {
      try {
        await execFileAsync(python, ['-c', SANMIAO_IMPORT_CHECK], {
          timeout: 15_000,
          env,
        });
        cachedPython = python;
        cachedDevRoot = root;
        logSanmiao('using python with PYTHONPATH', { python, root });
        return python;
      } catch (error) {
        recordFailure(`${python} (PYTHONPATH=${root}/src)`, error);
      }
    }
  }

  const devHint = root
    ? ` Editable setup: cd ${root} && python3 -m venv .venv && .venv/bin/pip install -e ".[fuzzy]"`
    : '';
  const failureHint = failures.length > 0 ? ` [${failures.join(' | ')}]` : '';
  throw new Error(
    `Sanmiao >= ${MIN_SANMIAO_VERSION} is not available.${devHint} ` +
      `Or: pip install -U sanmiao — or set SANMIAO_PYTHON.${failureHint}`,
  );
};

const pythonEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (cachedDevRoot) {
    env.PYTHONPATH = [path.join(cachedDevRoot, 'src'), env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  }
  return env;
};

const runSanmiaoCli = (
  payload: Record<string, unknown>,
  onProgress?: SanmiaoProgressCallback,
): Promise<string> => {
  const useStream = Boolean(onProgress && (payload.chunks || payload.dates));

  return new Promise(async (resolve, reject) => {
    let python: string;
    try {
      python = await resolveSanmiaoPython();
    } catch (error) {
      reject(error);
      return;
    }

    const input = JSON.stringify(useStream ? { ...payload, stream: true } : payload);
    const t0 = Date.now();
    logSanmiao('spawn', {
      stream: useStream,
      chunks: Array.isArray(payload.chunks) ? payload.chunks.length : 0,
    });

    const child = spawn(python, ['-c', 'from sanmiao.tei_bridge import cli_main; cli_main()'], {
      env: { ...pythonEnv(), PYTHONWARNINGS: 'ignore::RuntimeWarning' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let lineBuffer = '';
    let resultLine: string | null = null;

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Sanmiao timed out after ${SANMIAO_TIMEOUT_MS / 1000}s`));
    }, SANMIAO_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (useStream) {
        lineBuffer += text;
        let newline = lineBuffer.indexOf('\n');
        while (newline !== -1) {
          const line = lineBuffer.slice(0, newline).trim();
          lineBuffer = lineBuffer.slice(newline + 1);
          if (line) {
            try {
              const event = JSON.parse(line) as { type: string };
              if (event.type === 'result') {
                resultLine = line;
              } else if (event.type === 'init' || event.type === 'chunk') {
                onProgress?.(event as SanmiaoChunkProgress);
                logSanmiao('progress', event as Record<string, unknown>);
              }
            } catch {
              logSanmiao('bad progress line', { line: line.slice(0, 200) });
            }
          }
          newline = lineBuffer.indexOf('\n');
        }
      } else {
        stdout += text;
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      logSanmiao('done', { code, ms: Date.now() - t0 });
      if (code !== 0) {
        const lines = stderr.trim().split('\n').filter((line) => line.trim());
        const tracebackIdx = lines.findIndex((line) => line.startsWith('Traceback'));
        const detail =
          tracebackIdx >= 0
            ? lines.slice(tracebackIdx).join('\n')
            : lines.filter((line) => !line.includes('FutureWarning')).join('\n');
        logSanmiao('failed', { code, stderr: detail.slice(0, 2000) });
        reject(new Error(detail.trim() || `sanmiao exited with code ${code}`));
        return;
      }
      if (useStream) {
        if (lineBuffer.trim()) {
          resultLine = lineBuffer.trim();
        }
        if (!resultLine) {
          reject(new Error('Sanmiao stream mode returned no result line'));
          return;
        }
        resolve(resultLine);
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(input);
    child.stdin.end();
  });
};

export const sanmiaoProposeDates = async (
  text: string,
  options: SanmiaoProposeOptions = {},
): Promise<SanmiaoProposal[]> => {
  const stdout = await runSanmiaoCli({ text, ...options });
  const parsed = JSON.parse(stdout) as SanmiaoProposal[];
  return Array.isArray(parsed) ? parsed : [];
};

export const sanmiaoProposeDatesBatch = async (
  chunks: string[],
  options: SanmiaoProposeOptions = {},
  onProgress?: SanmiaoProgressCallback,
): Promise<SanmiaoProposal[][]> => {
  const stdout = await runSanmiaoCli({ chunks, ...options }, onProgress);
  const parsed = JSON.parse(stdout) as { type: string; results: SanmiaoProposal[][] };
  if (parsed && parsed.type === 'result' && Array.isArray(parsed.results)) {
    return parsed.results;
  }
  const fallback = JSON.parse(stdout) as SanmiaoProposal[][];
  return Array.isArray(fallback) ? fallback : [];
};

export const sanmiaoTagDatesBatch = async (
  chunks: string[],
  options: SanmiaoProposeOptions = {},
  onProgress?: SanmiaoProgressCallback,
): Promise<SanmiaoProposal[][]> => {
  const stdout = await runSanmiaoCli({ mode: 'tag', chunks, ...options }, onProgress);
  const parsed = JSON.parse(stdout) as { type: string; results: SanmiaoProposal[][] };
  if (parsed && parsed.type === 'result' && Array.isArray(parsed.results)) {
    return parsed.results;
  }
  const fallback = JSON.parse(stdout) as SanmiaoProposal[][];
  return Array.isArray(fallback) ? fallback : [];
};

export const sanmiaoResolveDatesBatch = async (
  dates: string[],
  options: SanmiaoProposeOptions = {},
  onProgress?: SanmiaoProgressCallback,
): Promise<(SanmiaoProposal | null)[]> => {
  const stdout = await runSanmiaoCli({ mode: 'resolve', dates, ...options }, onProgress);
  const parsed = JSON.parse(stdout) as { type: string; results: (SanmiaoProposal | null)[] };
  if (parsed && parsed.type === 'result' && Array.isArray(parsed.results)) {
    return parsed.results;
  }
  const fallback = JSON.parse(stdout) as (SanmiaoProposal | null)[];
  return Array.isArray(fallback) ? fallback : [];
};

export interface DynastyAuthorityEntry {
  dynId: number;
  label: string;
  startYear?: number | null;
  endYear?: number | null;
  calStream?: number | null;
}

export interface RulerAuthorityEntry {
  rulerId: number;
  dynId: number;
  label: string;
  dynLabel: string;
  startYear?: number | null;
  endYear?: number | null;
}

export interface EraAuthorityEntry {
  eraId: number;
  dynId: number;
  rulerId?: number | null;
  label: string;
  labelSimp?: string | null;
  dynLabel: string;
  rulerLabel: string;
  startYear?: number | null;
  endYear?: number | null;
}

export interface DateAuthorityIndex {
  dynasties: DynastyAuthorityEntry[];
  rulers: RulerAuthorityEntry[];
  eras: EraAuthorityEntry[];
}

export const sanmiaoListDateAuthority = async (
  options: SanmiaoProposeOptions = {},
): Promise<DateAuthorityIndex> => {
  const stdout = await runSanmiaoCli({ mode: 'authority', ...options });
  const parsed = JSON.parse(stdout) as DateAuthorityIndex;
  return {
    dynasties: Array.isArray(parsed.dynasties) ? parsed.dynasties : [],
    rulers: Array.isArray(parsed.rulers) ? parsed.rulers : [],
    eras: Array.isArray(parsed.eras) ? parsed.eras : [],
  };
};
