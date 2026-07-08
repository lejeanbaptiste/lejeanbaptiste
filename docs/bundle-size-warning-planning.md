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

## Remove before splitting

A static audit found several things that can be removed or narrowed before introducing new lazy
boundaries. The effects are deliberately separated by where they matter:

| Candidate | Priority | Expected effect | Assessment |
| --- | --- | --- | --- |
| Keep `jotai-devtools` and its stylesheet out of production | High | Reduces initial JS/CSS and its parse/evaluation work | The UI is already development-only, but its static imports make the implementation and stylesheet reachable from the main entry. Preserve it through a development-only entry or remove it if it is no longer useful. |
| Replace the broad Font Awesome import with only the styles/icons in use | High | Reduces initial CSS and font transfer; the unused brands font alone is about 110 KB uncompressed | The code uses solid and regular classes but no brand icons. This is first-load waste rather than only package clutter. |
| Copy only the TinyMCE skins used at runtime | Medium | Removes roughly 360 KB of desktop/release package files; little or no initial-load improvement | Runtime configuration names the light/dark UI skins and the `writer`/`dark` minified content skins. Default, document, mobile, shadow-DOM, UI-content, and duplicate unminified variants appear unused. Verify which `skin.css` filename TinyMCE requests before pruning. |
| Remove unreferenced copied images | Medium | Removes roughly 70 KB from the desktop/release package | `calendar-alt-regular copy.svg`, `cwrclogo-black.png`, and `cwrclogo-white.png` have no runtime or stylesheet references. |
| Remove `react-scan` | Low | About 6 MB less in an installed development workspace; no current app-chunk or packaged-desktop reduction | Its only source references are commented out. |
| Remove `layout-jquery3` | Low | About 12 MB less in an installed development workspace; no current app-chunk or packaged-desktop reduction | The editor imports a checked-in jQuery Layout implementation instead of this package. |
| Remove direct `vscode-jsonrpc@8` | Low | Removes a redundant installed package/version; no current app-chunk reduction | Source imports `vscode-languageserver-protocol`, which supplies its own `vscode-jsonrpc@9`; nothing imports the direct dependency. |

The copied `samples.json` and `templates.json` files need separate treatment. Together they add
about 1.5 MB to the release package, mostly embedded screenshots, but they are fetched as runtime
content and are not compiled into `js/app.js`. Optimizing them helps download/install size and the
template-dialog path, not initial JavaScript parse time.

## What we can do about it

### 1. Measure first

Before changing code, we should identify the biggest actual chunk contributors.

Good questions:

- Which modules dominate `js/app.js`?
- Are the workers bundled eagerly or split properly?
- Is large JSON being imported into the app bundle instead of fetched at runtime?
- Are any assets duplicated across chunks?

#### Production baseline (2026-07-09)

A production webpack profile of the current worktree produced:

| Initial asset | Emitted | Gzip level 9 | Assessment |
| --- | ---: | ---: | --- |
| `js/app.js` | 31.97 MB | 7.89 MB | The primary startup problem: all of it belongs to the initial entry chunk and must be read, decompressed, parsed, and evaluated before the app is fully available. |
| `css/app.css` | 1.41 MB | 831 KB | Unusually large; about 1.04 MB of webpack's pre-minification module input is the statically imported `jotai-devtools` stylesheet. |

The initial chunk contains 2,220 top-level webpack modules and about 50.7 MB of pre-minification
module input. Module-input sizes are useful for ranking causes but are not equivalent to emitted
bytes because tree-shaking and minification happen afterward.

Largest main-chunk contributors:

| Contributor | Profile size | Priority | Exact stake |
| --- | ---: | --- | --- |
| Monaco editor API | 5.17 MB across 556 concatenated modules | High, but structural | A real editor engine needed only for source-oriented features. It dominates parse/compile work if kept in the initial chunk; splitting it is more valuable than trying to micro-optimize it. |
| Commons application group | 4.12 MB across 619 modules | Investigate by feature | This is an aggregation bucket, not one removable module. It confirms that most routes/features currently share the entry boundary. |
| `mdi-material-ui` barrel | 3.82 MB / 7,438 modules | Urgent | Webpack reports all 7,447 exports as used. Imports through the barrel, including the compiled CommonJS storage-service output, make the whole icon catalog reachable. Replace with per-icon paths and rebuild the storage service. |
| `react-icons` CommonJS packs (`md`, `bi`, `rx`) | 3.83 MB combined | Urgent | These three whole catalogs are marked fully used, alongside tree-shakeable ESM copies. They enter through compiled CommonJS storage-service code. Fixing that package boundary should remove both whole-pack code and format duplication. |
| LEAF-Writer dialogs group | 3.59 MB across 233 modules | High | Dialogs pull optional tools such as image viewing, citation processing, and source editing into startup. This is the strongest feature-level lazy-load boundary. |
| TinyMCE core and Silver theme | 2.09 MB before plugins | Medium/high | Legitimate visual-editor runtime. Defer it only if the shell can appear before an editor document is opened; otherwise it is expected core cost. |
| `jotai-devtools` stylesheet | 1.04 MB module input | Urgent | Development UI styling is statically present in the production CSS graph. Removing it is low-risk first-load reduction. |
| OpenSeadragon | 859 KB | High | Image-viewer-only runtime currently paid by every startup. A strong dialog/panel-level split candidate. |
| Citeproc plus three bundled CSL styles | about 1.17 MB | High | Citation-only functionality and static style text are in the entry chunk. Load them when citation tools open. |
| `html2canvas` | 368 KB | High | Used only by the screenshot API but imported by the package entry. A dynamic import inside `getDocumentScreenshot()` avoids charging normal startup. |
| Sentry Replay | 292 KB | Medium | Session-replay code is initial even when telemetry configuration may not require it. Configure/integrate it only when enabled. |
| Duplicate Lodash builds | about 405 KB | Medium | Root and package-local versions are both present. Align versions/resolution, then prefer narrow imports where practical. |

The `react-icons` ESM catalog files also look very large in raw stats, but webpack records only the
named exports as used and the minifier removes the rest. They are build-work overhead, not equivalent
to shipping every ESM icon. The CommonJS copies above are different: webpack marks every export used,
so they represent genuine emitted-code waste.

### 2. Quick wins

These are the low-risk changes that often produce visible gains.

- Lazy-load heavy features that are not needed on first paint.
- Remove or narrow the production-only waste identified above.
- Replace embedded sample/template screenshots with separate optimized image files or load them only
  when the chooser needs them.
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

1. Replace `mdi-material-ui` barrel imports, eliminate CommonJS whole-pack `react-icons` imports,
   and rebuild the storage service.
2. Remove production devtools and narrow the broad Font Awesome import.
3. Dynamically load `html2canvas`, then split citation and image-viewer functionality from dialogs.
4. Decide whether Monaco can sit behind the source-editor boundary without harming editor startup.
5. Remove unused copied skins/images and stale dependencies.
6. Optimize the separately fetched sample/template content.
7. Split or defer worker bundles where their current loading behavior warrants it.
8. Re-run the production profile and compare emitted, gzip, parse, and package sizes after each step.

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

Fix the storage-service/icon import boundary first and rebuild the production profile. It is the
largest measured non-essential contributor and will establish how much of the warning is accidental
module-format/barrel overhead before structural lazy-loading begins.
