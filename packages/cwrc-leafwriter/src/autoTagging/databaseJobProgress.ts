/**
 * Global progress for long Database Window jobs (backfill, hygiene scan, …).
 * Survives switching back to the editor so the BottomBar can keep showing
 * progress and cancel after DatabaseWindow unmounts.
 */
export interface DatabaseJobProgress {
  active: boolean;
  cancel: (() => void) | null;
  done: number;
  total: number;
  label: string;
  detail: string;
}

let state: DatabaseJobProgress = {
  active: false,
  cancel: null,
  done: 0,
  total: 0,
  label: '',
  detail: '',
};
const listeners = new Set<() => void>();

const emit = (next: Partial<DatabaseJobProgress>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const getDatabaseJobProgress = (): DatabaseJobProgress => state;
export const subscribeDatabaseJobProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const startDatabaseJobProgress = (label: string, cancel: () => void, total = 0): void => {
  emit({ active: true, cancel, done: 0, total, label, detail: '' });
};

export const updateDatabaseJobProgress = (
  patch: Partial<Pick<DatabaseJobProgress, 'done' | 'total' | 'label' | 'detail'>>,
): void => {
  if (!state.active) return;
  emit(patch);
};

export const finishDatabaseJobProgress = (): void => {
  emit({ active: false, cancel: null, done: 0, total: 0, label: '', detail: '' });
};
