import { webpackEnv } from '../../types';

/**
 * The dev-mode validator worker URL, isolated in its own module.
 *
 * Two constraints have to hold at once here.
 *
 * `import.meta` is a syntax error in CommonJS output, and ts-jest compiles to
 * CommonJS — so any module containing it fails to *parse* under jest whether or
 * not the line runs. Keeping it out of `validator/actions.ts` is what makes the
 * overmind config importable in tests, and with it everything downstream: most
 * of the editor could not be mounted at all before.
 *
 * But the `WORKER_ENV` guard has to stay wrapped around the expression, not just
 * around the call site. webpack folds that constant at build time and drops the
 * dead branch *before resolving it*; without the guard the `new URL` is
 * unconditional, and a production build tries to resolve
 * `@cwrc/leafwriter-validator`, which does not export `.` under production
 * conditions. Hoisting the expression without its guard is exactly what broke
 * the build once — every desktop job failed while tests stayed green, because no
 * test compiles with webpack.
 *
 * Returns null outside development; `loadWebworker` loads the worker from a
 * plain path there instead.
 */
export const devValidatorWorkerUrl = (): URL | null =>
  webpackEnv.WORKER_ENV === 'development'
    ? new URL('@cwrc/leafwriter-validator', import.meta.url)
    : null;
