import jquery from 'jquery';

/**
 * Webpack/esbuild interop can sometimes hand legacy code a namespace object
 * instead of the callable jQuery function. Re-export the real browser build
 * explicitly so `import $ from 'jquery'` always stays callable.
 */
const $ = jquery as typeof jquery & ((...args: Parameters<typeof jquery>) => ReturnType<typeof jquery>);

export default $;
