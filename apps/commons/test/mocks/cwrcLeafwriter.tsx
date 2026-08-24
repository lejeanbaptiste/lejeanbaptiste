import { atom } from 'jotai';

/**
 * Stands in for the bare `@cwrc/leafwriter` specifier in commons tests.
 *
 * That specifier resolves to the package's built webpack bundle, which throws
 * "Automatic publicPath is not supported in this browser" the moment it is
 * evaluated under jsdom. Any commons module that reaches it — `devtoolsLog`, and
 * so transitively `useLeafWriter` and everything importing that — was therefore
 * untestable, which is a large share of the desktop UI.
 *
 * Only three runtime symbols are imported from the bare specifier anywhere in
 * commons, so this stub covers them. Subpath imports such as
 * `@cwrc/leafwriter/documentExport` are mapped to real source in jest.config.ts
 * and are unaffected.
 */

export const SETTINGS_BOOTSTRAP_URL = 'about:blank';

export const entityLookupDialogAtom = atom<unknown>(null);

const Leafwriter = () => null;

export default Leafwriter;
