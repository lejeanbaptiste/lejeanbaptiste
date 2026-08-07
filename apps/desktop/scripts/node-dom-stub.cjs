/**
 * Minimal browser globals so cwrc-leafwriter modules that touch `document`
 * can load under plain Node (headless SQLite scripts).
 */
const fragment = {
  querySelector() {
    return null;
  },
};

globalThis.document = globalThis.document ?? {
  createDocumentFragment: () => fragment,
};

globalThis.window = globalThis.window ?? {
  open() {
    return null;
  },
};
