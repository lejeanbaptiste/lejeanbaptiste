/** Global progress for a background AI suggest or audit run. */
export interface AiRunProgress {
  active: boolean;
  cancel: (() => void) | null;
  done: number;
  total: number;
  label: string;
}

let state: AiRunProgress = { active: false, cancel: null, done: 0, total: 0, label: '' };
const listeners = new Set<() => void>();

const emit = (next: Partial<AiRunProgress>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const getAiRunProgress = (): AiRunProgress => state;
export const subscribeAiRunProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const startAiRunProgress = (label: string, cancel: () => void) =>
  emit({ active: true, cancel, done: 0, total: 0, label });
export const updateAiRunProgress = (done: number, total: number) => emit({ done, total });
export const finishAiRunProgress = () =>
  emit({ active: false, cancel: null, done: 0, total: 0, label: '' });
