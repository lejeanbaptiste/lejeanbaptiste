export interface EntityIndexProgress {
  active: boolean;
  done: number;
  total: number;
  label: string;
  cancel?: () => void;
}

let current: EntityIndexProgress = { active: false, done: 0, total: 0, label: '' };
const listeners = new Set<() => void>();

export const getEntityIndexProgress = (): EntityIndexProgress => current;
export const subscribeEntityIndexProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const setEntityIndexProgress = (next: EntityIndexProgress): void => {
  current = next;
  listeners.forEach((listener) => listener());
};
