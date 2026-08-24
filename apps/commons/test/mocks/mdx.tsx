/**
 * Stands in for `.mdx` content imports under jest.
 *
 * Pages that embed documentation (privacy, help) import MDX, which the real
 * build compiles with @mdx-js/loader. Tests only need the import to resolve and
 * render nothing.
 */
const MdxStub = () => null;

export default MdxStub;
