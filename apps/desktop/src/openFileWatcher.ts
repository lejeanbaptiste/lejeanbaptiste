import { statSync, watch, type FSWatcher } from 'fs';
import type { BrowserWindow } from 'electron';

const DEBOUNCE_MS = 300;
const IGNORE_TTL_MS = 2_000;
// A caller may arm a path well before the actual disk write reaches us — e.g. the
// renderer is busy serializing a large document — so this window is generous
// compared to IGNORE_TTL_MS, which only needs to cover post-write notification lag.
const ARM_TTL_MS = 10_000;

interface IgnoredChange {
  expiresAt: number;
  mtimeMs: number;
}

export class OpenFileWatcher {
  private watchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private ignoredChanges = new Map<string, IgnoredChange>();
  private armedWrites = new Map<string, number>();
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

  /**
   * Call before a known write starts, so a slow renderer (e.g. mid-serialization
   * of a large document) can't lose the race against the debounce timer below —
   * the notification is suppressed unconditionally until `ignoreChange` confirms
   * the write's resulting mtime, or this arming window lapses.
   */
  armWrite(filePath: string) {
    this.armedWrites.set(filePath, Date.now() + ARM_TTL_MS);
  }

  ignoreChange(filePath: string, mtimeMs: number) {
    this.armedWrites.delete(filePath);
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
    this.armedWrites.clear();
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
    const armedUntil = this.armedWrites.get(filePath);
    if (armedUntil !== undefined) {
      if (Date.now() <= armedUntil) return true;
      this.armedWrites.delete(filePath);
    }

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
