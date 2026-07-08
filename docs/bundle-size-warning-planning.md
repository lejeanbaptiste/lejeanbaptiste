# Bundle Size Warning - Planning Note

**Status:** Planning only  
**Scope:** Desktop and shared webpack bundles  
**Related:** `docs/todo.md`, `docs/versioning-planning.md`

## What the warning means

Webpack is warning that one or more emitted assets are larger than its recommended threshold. That is not a build failure, but it is a signal that:

- initial load may be slower,
- memory use may be higher,
- source maps and rebuilds may be noisier,
- small regressions can quietly accumulate over time.

For this repo, the warning is usually more of a performance and release-risk signal than a correctness problem.

## Current likely contributors

From the last build output, the biggest sources were:

- `js/app.js`
- `css/app.css`
- Monaco worker bundles such as `monaco-editor.worker.js` and `monaco-json.worker.js`
- the validation worker bundle
- bundled sample/template JSON
- large static image assets

That points to a mix of:

- application code that is pulled into the first chunk,
- editor/runtime dependencies that are expensive by design,
- static content that may be better loaded on demand.

## What we can do about it

### 1. Measure first

Before changing code, we should identify the biggest actual chunk contributors.

Good questions:

- Which modules dominate `js/app.js`?
- Are the workers bundled eagerly or split properly?
- Is large JSON being imported into the app bundle instead of fetched at runtime?
- Are any assets duplicated across chunks?

### 2. Quick wins

These are the low-risk changes that often produce visible gains.

- Lazy-load heavy features that are not needed on first paint.
- Move sample/template JSON out of the initial bundle and load it from disk or fetch it only when needed.
- Split large feature areas into route-level or dialog-level chunks.
- Avoid importing editor-only or validation-only code from shared startup paths.
- Compress or externalize large images where practical.

### 3. Medium-effort fixes

These usually require a small amount of code restructuring.

- Split Monaco worker loading so only the needed worker is loaded for a given editor mode.
- Separate validation worker code from the main shell if it is currently bundled eagerly.
- Reduce shared dependencies between desktop shell startup and editor-only screens.
- Replace broad imports with narrower entry points where the library supports it.

### 4. Larger structural changes

These are worth doing if the bundle remains too heavy after the easy wins.

- Introduce more deliberate code splitting around editor, validation, and search features.
- Rework how large bundled content is stored so it does not ship in the core app chunk.
- Audit whether some dependencies can be swapped for lighter alternatives.

## Practical priorities

If we want the highest return with the least risk, the order should be:

1. Find the largest modules in the main chunk.
2. Move static sample/template data out of the initial load.
3. Lazy-load optional feature areas.
4. Split or defer worker bundles.
5. Re-run the build and compare bundle output after each step.

## What not to chase first

Not every warning is worth fixing immediately.

- A large editor bundle is expected in this kind of app.
- Monaco workers will never be tiny.
- CSS can look large in webpack output even when it is not a user-facing problem.

We should focus on changes that reduce startup cost or memory footprint, not just the raw number reported by webpack.

## Success criteria

The warning work is done when:

- the main app chunk is materially smaller,
- startup work is pushed behind lazy boundaries where possible,
- the build output is easier to explain,
- and we can point to a concrete reason for any remaining large assets.

## Suggested next step

Run a bundle breakdown on the desktop build, then fix the largest non-essential first-load contributor first. That will tell us quickly whether the warning is mostly structural or mostly unavoidable editor overhead.
