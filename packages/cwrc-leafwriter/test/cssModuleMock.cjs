// CSS modules resolve to a class-name map in the real build. Tests only need the
// lookups to be harmless, so every key returns its own name — enough for a
// `className` to be a stable string without pulling a CSS transformer in.
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === '__esModule' ? false : String(key)),
  },
);
