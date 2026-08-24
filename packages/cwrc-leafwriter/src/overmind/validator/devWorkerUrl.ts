/**
 * The dev-mode validator worker URL, isolated in its own module.
 *
 * webpack resolves `new URL(specifier, import.meta.url)` at build time to emit
 * the worker bundle, so the expression has to stay written exactly like this.
 * But `import.meta` is a syntax error in CommonJS output, and ts-jest compiles
 * to CommonJS — so any module containing it fails to *parse* under jest, whether
 * or not the line ever runs. In `validator/actions.ts` that made every test
 * transitively importing this package's overmind unrunnable, which is most of
 * the editor: the module is pulled in through the overmind config, so nothing
 * downstream could be mounted in a test at all.
 *
 * Keeping the expression here means `actions.ts` compiles cleanly, and jest maps
 * this one file to a stub (see the `devWorkerUrl` entries in jest.config.ts).
 * Only the development branch of `loadWebworker` calls it; production loads the
 * worker from a plain path.
 */
export const devValidatorWorkerUrl = (): URL =>
  new URL('@cwrc/leafwriter-validator', import.meta.url);
