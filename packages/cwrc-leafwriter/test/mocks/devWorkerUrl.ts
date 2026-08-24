/**
 * Stands in for `overmind/validator/devWorkerUrl` under jest.
 *
 * The real module holds `new URL(..., import.meta.url)`, which webpack needs
 * verbatim but ts-jest cannot compile to CommonJS.
 *
 * Returns null, matching what the real module returns outside development — so
 * `loadWebworker` takes the plain-path branch. No test spawns the validator
 * worker; handing back a URL here would only push jsdom into constructing one.
 */
export const devValidatorWorkerUrl = (): URL | null => null;
