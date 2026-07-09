// jest-environment-jsdom's global scope doesn't include structuredClone, which
// fake-indexeddb (used by Dexie-backed caches) needs for every put/get. Our cache
// rows are plain JSON-serializable data, so a JSON round-trip is an adequate polyfill.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}
