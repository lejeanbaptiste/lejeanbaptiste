/**
 * Stands in for `overmind/validator/devWorkerUrl` under jest.
 *
 * The real module holds `new URL(..., import.meta.url)`, which webpack needs
 * verbatim but ts-jest cannot compile to CommonJS. Only the development branch
 * of `loadWebworker` calls this, and no test spawns the validator worker, so a
 * placeholder URL is enough.
 */
export const devValidatorWorkerUrl = (): URL => new URL('http://localhost/validator.worker.js');
