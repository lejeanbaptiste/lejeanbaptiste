// jest-environment-jsdom's global scope doesn't include fetch (real browsers and
// Electron always have it). `@cwrc/salve-dom-leafwriter` checks for it when the
// module is first evaluated — "all resource loaders require fetch to be
// available" — so anything importing this package's overmind failed to load at
// all, not just when a test actually fetched something.
//
// Node provides a real implementation, so hand that over when it exists. The
// fallback rejects rather than returning an empty response: a test that really
// does need the network should fail loudly, not silently see nothing.
if (typeof globalThis.fetch !== 'function') {
  const nodeFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  globalThis.fetch =
    nodeFetch ??
    (((): Promise<Response> =>
      Promise.reject(
        new Error('fetch is not stubbed in this test — mock the call you expect'),
      )) as unknown as typeof fetch);
}
