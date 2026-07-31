export interface BulkSyncProgress {
  active: boolean;
  done: number;
  total: number;
  label: string;
  cancel?: () => void;
}

let current: BulkSyncProgress = { active: false, done: 0, total: 0, label: '' };
const listeners = new Set<() => void>();

export const getBulkSyncProgress = (): BulkSyncProgress => current;
export const subscribeBulkSyncProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const setBulkSyncProgress = (next: BulkSyncProgress): void => {
  current = next;
  listeners.forEach((listener) => listener());
};
