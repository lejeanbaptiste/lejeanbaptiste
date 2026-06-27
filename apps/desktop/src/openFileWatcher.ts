import { statSync, watch, type FSWatcher } from 'fs';
import type { BrowserWindow } from 'electron';

const DEBOUNCE_MS = 300;
const IGNORE_TTL_MS = 2_000;

interface IgnoredChange {
  expiresAt: number;
  mtimeMs: number;
}

export class OpenFileWatcher {
  private watchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private ignoredChanges = new Map<string, IgnoredChange>();
  private getWindow: () => BrowserWindow | null;

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;
  }

  sync(paths: string[]) {
    const nextPaths = new Set(paths);

    for (const filePath of this.watchers.keys()) {
      if (!nextPaths.has(filePath)) {
        this.unwatch(filePath);
      }
    }

    for (const filePath of nextPaths) {
      if (!this.watchers.has(filePath)) {
        this.watch(filePath);
      }
    }
  }

  ignoreChange(filePath: string, mtimeMs: number) {
    this.ignoredChanges.set(filePath, {
      mtimeMs,
      expiresAt: Date.now() + IGNORE_TTL_MS,
    });
  }

  dispose() {
    for (const filePath of [...this.watchers.keys()]) {
      this.unwatch(filePath);
    }
    this.ignoredChanges.clear();
  }

  private watch(filePath: string) {
    try {
      const watcher = watch(filePath, () => {
        this.scheduleNotify(filePath);
      });
      watcher.on('error', () => {
        this.unwatch(filePath);
      });
      this.watchers.set(filePath, watcher);
    } catch {
      // File may have been deleted or is inaccessible.
    }
  }

  private unwatch(filePath: string) {
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }

    const watcher = this.watchers.get(filePath);
    watcher?.close();
    this.watchers.delete(filePath);
  }

  private scheduleNotify(filePath: string) {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.notifyChange(filePath);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  private notifyChange(filePath: string) {
    if (this.shouldIgnore(filePath)) return;

    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    window.webContents.send('file:external-change', { filePath });
  }

  private shouldIgnore(filePath: string): boolean {
    const ignored = this.ignoredChanges.get(filePath);
    if (!ignored) return false;

    if (Date.now() > ignored.expiresAt) {
      this.ignoredChanges.delete(filePath);
      return false;
    }

    try {
      const { mtimeMs } = statSync(filePath);
      if (mtimeMs <= ignored.mtimeMs) return true;
    } catch {
      return false;
    }

    this.ignoredChanges.delete(filePath);
    return false;
  }
}
