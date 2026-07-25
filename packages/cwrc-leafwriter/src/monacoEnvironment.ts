/**
 * Monaco's editor worker must be wired before any monaco.editor.create call.
 *
 * apps/commons webpack uses MonacoWebpackPlugin with fake feature/language ids
 * so the plugin does not pin Monaco into app.js — that also skips the loader
 * that would normally inject MonacoEnvironment. Point at the worker file the
 * plugin still emits into commons/public/.
 *
 * Import this module from every entry that creates a Monaco editor.
 */

export {};

if (typeof MonacoEnvironment === 'undefined' || !MonacoEnvironment) {
  MonacoEnvironment = {
    getWorkerUrl: () => {
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';
      return `${origin}/monaco-editor.worker.js`;
    },
  };
}
