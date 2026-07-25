/**
 * Generic subprocess bridge for hybrid plugins with a Python backend (manifest.entry.python).
 */

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  getCachedPluginHostSnapshot,
  isPluginEnabledInMain,
  resolvePluginPythonBinary,
} from './plugins/pluginHost';

const execFileAsync = promisify(execFile);

const PYTHON_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_SANMIAO_VERSION = '0.2.10';
const SANMIAO_SPEC = `sanmiao[fuzzy]==${MIN_SANMIAO_VERSION}`;

export type PluginPythonProgressEvent =
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

export type PluginPythonProgressCallback = (event: PluginPythonProgressEvent) => void;

const pythonCache = new Map<string, string>();
const devRootCache = new Map<string, string | null>();

const logPluginPython = (pluginId: string, message: string, data?: Record<string, unknown>) => {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[plugin-python:${pluginId}] ${message}${suffix}`);
};

const pluginRecord = (pluginId: string) =>
  getCachedPluginHostSnapshot()?.plugins.find((p) => p.id === pluginId && !p.manifestError);

const pythonModuleForPlugin = (pluginId: string): string => {
  const plugin = pluginRecord(pluginId);
  const moduleName = plugin?.manifest.entry?.python?.module?.trim();
  if (!moduleName) throw new Error(`Plugin ${pluginId} has no manifest.entry.python.module`);
  return moduleName;
};

/** Resolve sibling sanmiao repo (dev) for cjk-dates. */
const resolveSanmiaoDevRoot = (): string | null => {
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

const coreBundledPython = (): string | null => {
  const roots = [
    process.resourcesPath ? path.join(process.resourcesPath, 'python') : null,
    path.resolve(__dirname, '../resources/python'),
  ].filter((root): root is string => Boolean(root));
  for (const root of roots) {
    const python =
      process.platform === 'win32'
        ? path.join(root, 'python.exe')
        : path.join(root, 'bin', 'python3');
    if (fs.existsSync(python)) return python;
  }
  return null;
};

const pythonCandidatesForPlugin = (pluginId: string): string[] => {
  const fromEnv = process.env.SANMIAO_PYTHON?.trim();
  if (fromEnv) return [fromEnv];

  const pluginPython = resolvePluginPythonBinary(pluginId);
  if (pluginPython) return [pluginPython, 'python3', 'python'];

  const corePython = coreBundledPython();
  if (corePython) return [corePython, 'python3', 'python'];

  return ['python3', 'python'];
};

const isMissingSanmiaoModule = (stderr: string): boolean =>
  /ModuleNotFoundError: No module named ['"]sanmiao['"]/.test(stderr);

const tryAutoInstallSanmiao = async (pluginId: string, python: string): Promise<boolean> => {
  try {
    logPluginPython(pluginId, 'attempting automatic sanmiao install', { python, spec: SANMIAO_SPEC });
    await execFileAsync(python, ['-m', 'pip', 'install', '--user', '--upgrade', SANMIAO_SPEC], {
      timeout: 3 * 60 * 1000,
      env: process.env,
    });
    return true;
  } catch (error) {
    const stderr = (error as { stderr?: string })?.stderr ?? String(error);
    logPluginPython(pluginId, 'automatic sanmiao install failed', {
      python,
      reason: stderr.trim().slice(-500),
    });
    return false;
  }
};

const SANMIAO_IMPORT_CHECK = [
  'import re, sanmiao',
  'from sanmiao.tei_bridge import cli_main',
  `minimum = tuple(int(x) for x in "${MIN_SANMIAO_VERSION}".split("."))`,
  'found = tuple(int(x) for x in re.findall(r"\\d+", sanmiao.__version__)[:3])',
  'assert found >= minimum, f"sanmiao {sanmiao.__version__} is too old (need >= ' +
    MIN_SANMIAO_VERSION +
    ')"',
].join('; ');

const resolvePluginPython = async (pluginId: string): Promise<string> => {
  const cached = pythonCache.get(pluginId);
  if (cached) return cached;

  const devRoot = pluginId === 'cjk-dates' ? resolveSanmiaoDevRoot() : null;
  const failures: string[] = [];

  const recordFailure = (python: string, error: unknown) => {
    const stderr = (error as { stderr?: string })?.stderr ?? String(error);
    const assertion = stderr.match(/AssertionError: (.+)/)?.[1];
    const reason = assertion ?? stderr.trim().split('\n').pop() ?? 'unknown error';
    failures.push(`${python}: ${reason}`);
    logPluginPython(pluginId, 'candidate rejected', { python, reason });
  };

  for (const python of pythonCandidatesForPlugin(pluginId)) {
    try {
      await execFileAsync(python, ['-c', SANMIAO_IMPORT_CHECK], {
        timeout: 15_000,
        env: process.env,
      });
      pythonCache.set(pluginId, python);
      devRootCache.set(pluginId, null);
      logPluginPython(pluginId, 'using python', { python, devRoot: devRoot ?? undefined });
      return python;
    } catch (error) {
      const stderr = (error as { stderr?: string })?.stderr ?? String(error);
      if (isMissingSanmiaoModule(stderr) && (await tryAutoInstallSanmiao(pluginId, python))) {
        try {
          await execFileAsync(python, ['-c', SANMIAO_IMPORT_CHECK], {
            timeout: 15_000,
            env: process.env,
          });
          pythonCache.set(pluginId, python);
          devRootCache.set(pluginId, null);
          logPluginPython(pluginId, 'using python (auto-installed sanmiao)', { python });
          return python;
        } catch (retryError) {
          recordFailure(python, retryError);
          continue;
        }
      }
      recordFailure(python, error);
    }
  }

  if (devRoot) {
    const env = { ...process.env, PYTHONPATH: path.join(devRoot, 'src') };
    for (const python of ['python3', 'python']) {
      try {
        await execFileAsync(python, ['-c', SANMIAO_IMPORT_CHECK], {
          timeout: 15_000,
          env,
        });
        pythonCache.set(pluginId, python);
        devRootCache.set(pluginId, devRoot);
        logPluginPython(pluginId, 'using python with PYTHONPATH', { python, devRoot });
        return python;
      } catch (error) {
        recordFailure(`${python} (PYTHONPATH=${devRoot}/src)`, error);
      }
    }
  }

  const devHint = devRoot
    ? ` Editable setup: cd ${devRoot} && python3 -m venv .venv && .venv/bin/pip install -e ".[fuzzy]"`
    : '';
  const failureHint = failures.length > 0 ? ` [${failures.join(' | ')}]` : '';
  throw new Error(
    `Plugin ${pluginId} Python backend (sanmiao >= ${MIN_SANMIAO_VERSION}) is not available.${devHint} ` +
      `Run "npm run python:download" in plugin-cjk-dates, or set SANMIAO_PYTHON.${failureHint}`,
  );
};

const pythonEnvForPlugin = (pluginId: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const devRoot = devRootCache.get(pluginId);
  if (devRoot) {
    env.PYTHONPATH = [path.join(devRoot, 'src'), env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  }
  return env;
};

const runPluginPythonCli = (
  pluginId: string,
  payload: Record<string, unknown>,
  onProgress?: PluginPythonProgressCallback,
): Promise<string> => {
  const useStream = Boolean(onProgress && (payload.chunks || payload.dates));
  const moduleName = pythonModuleForPlugin(pluginId);

  return new Promise(async (resolve, reject) => {
    let python: string;
    try {
      python = await resolvePluginPython(pluginId);
    } catch (error) {
      reject(error);
      return;
    }

    const input = JSON.stringify(useStream ? { ...payload, stream: true } : payload);
    const t0 = Date.now();
    logPluginPython(pluginId, 'spawn', {
      module: moduleName,
      stream: useStream,
      chunks: Array.isArray(payload.chunks) ? payload.chunks.length : 0,
    });

    const child = spawn(python, ['-c', `from ${moduleName} import cli_main; cli_main()`], {
      env: { ...pythonEnvForPlugin(pluginId), PYTHONWARNINGS: 'ignore::RuntimeWarning' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let lineBuffer = '';
    let resultLine: string | null = null;
    let settled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
      settled = true;
      reject(new Error(`Plugin ${pluginId} Python timed out after ${PYTHON_TIMEOUT_MS / 1000}s`));
    }, PYTHON_TIMEOUT_MS);

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
                onProgress?.(event as PluginPythonProgressEvent);
                logPluginPython(pluginId, 'progress', event as Record<string, unknown>);
              }
            } catch {
              logPluginPython(pluginId, 'bad progress line', { line: line.slice(0, 200) });
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
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (settled) return;
      settled = true;
      logPluginPython(pluginId, 'done', { code, ms: Date.now() - t0 });
      if (code !== 0) {
        const lines = stderr.trim().split('\n').filter((line) => line.trim());
        const tracebackIdx = lines.findIndex((line) => line.startsWith('Traceback'));
        const detail =
          tracebackIdx >= 0
            ? lines.slice(tracebackIdx).join('\n')
            : lines.filter((line) => !line.includes('FutureWarning')).join('\n');
        logPluginPython(pluginId, 'failed', { code, stderr: detail.slice(0, 2000) });
        reject(new Error(detail.trim() || `${pluginId} python exited with code ${code}`));
        return;
      }
      if (useStream) {
        if (lineBuffer.trim()) resultLine = lineBuffer.trim();
        if (!resultLine) {
          reject(new Error(`Plugin ${pluginId} stream mode returned no result line`));
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

const parseSanmiaoStdout = (stdout: string, payload: Record<string, unknown>): unknown => {
  const parsed = JSON.parse(stdout) as { type?: string; results?: unknown };
  if (parsed && parsed.type === 'result' && 'results' in parsed) {
    return parsed.results;
  }
  if (payload.mode === 'authority') {
    return parsed;
  }
  if (payload.text && !payload.chunks && !payload.dates) {
    return Array.isArray(parsed) ? parsed : parsed;
  }
  return parsed;
};

/** Invoke a hybrid plugin Python backend; returns parsed JSON for sanmiao tei_bridge protocol. */
export const invokePluginPython = async (
  pluginId: string,
  payload: Record<string, unknown>,
  onProgress?: PluginPythonProgressCallback,
): Promise<unknown> => {
  if (!isPluginEnabledInMain(pluginId)) {
    throw new Error(`Plugin not enabled: ${pluginId}`);
  }
  const stdout = await runPluginPythonCli(pluginId, payload, onProgress);
  return parseSanmiaoStdout(stdout, payload);
};

export const clearPluginPythonCache = (pluginId?: string): void => {
  if (pluginId) {
    pythonCache.delete(pluginId);
    devRootCache.delete(pluginId);
    return;
  }
  pythonCache.clear();
  devRootCache.clear();
};
