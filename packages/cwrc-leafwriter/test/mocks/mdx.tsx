/**
 * Stands in for `.mdx` content imports under jest.
 *
 * Dialogs that embed documentation (privacy, help) import MDX, compiled by
 * @mdx-js/loader in the real build. Tests only need the import to resolve and
 * render nothing.
 */
const MdxStub = () => null;

export default MdxStub;
