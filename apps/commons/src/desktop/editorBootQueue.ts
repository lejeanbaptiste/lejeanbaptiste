/**
 * Serialize Leaf-Writer / TinyMCE boots so settings bootstrap and document
 * open cannot race. Concurrent callers wait their turn instead of starting a
 * second half-initialized editor.
 */
type BootTask<T> = () => Promise<T>;

let chain: Promise<unknown> = Promise.resolve();

export const runEditorBoot = <T>(label: string, task: BootTask<T>): Promise<T> => {
  const run = chain.then(async () => {
    if (
      process.env.NODE_ENV !== 'production' ||
      window.localStorage?.getItem('GROGNARD_DEBUG') === '1'
    ) {
      console.info(`[editor-boot] start ${label}`);
    }
    try {
      return await task();
    } finally {
      if (
        process.env.NODE_ENV !== 'production' ||
        window.localStorage?.getItem('GROGNARD_DEBUG') === '1'
      ) {
        console.info(`[editor-boot] end ${label}`);
      }
    }
  });

  // Keep the queue alive even if one boot fails.
  chain = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
};
