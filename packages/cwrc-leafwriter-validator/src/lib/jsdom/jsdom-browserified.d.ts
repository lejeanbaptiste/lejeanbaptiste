// Browserified build of the `jsdom` npm package (bundled for use inside a web
// worker, where the plain package can't run). Same API surface, so reuse its types.
import type { JSDOM } from 'jsdom';

declare const jsdomBrowserified: { JSDOM: typeof JSDOM };
export default jsdomBrowserified;
