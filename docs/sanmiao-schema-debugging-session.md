# Sanmiao schema validation bugs — debugging session log

**Status:** Six bugs fixed and verified; a seventh (validate/initialize race) fixed but not yet confirmed live.
**Related:** `docs/sanmiao-dates-schema.md` (design), `docs/sanmiao-ljb-integration.md` (integration)

This log documents a single extended debugging session chasing why sanmiao-tagged
dates (`<date><era>...</era><year>...</year>...</date>`) were rejected by the
app despite the schema merge appearing to work. It turned out to be **seven
separate, independently-broken layers**, each masking the next once fixed.
Kept as a reference because the symptom ("schema doesn't allow X") recurred
after each fix looked complete, and the diagnostic technique that finally
isolated each layer is reusable.

## Symptom history (roughly chronological)

1. "Schema does not allow `<date>` inside `<p>`" — auto-tagging apply blocked everything.
2. Same error persisted after a first schema fix.
3. Validation *panel* (checkmark icon) still showed "Tag `era`/`year`/... not allowed in `date`" — 542 errors — even after the auto-tagging path was fixed.
4. Same 542 errors persisted through multiple app restarts, hard refreshes, and rebuilds.
5. After finally getting the underlying pipeline provably correct, the validation panel got stuck in a continuous refresh loop, count still unchanged.

## Bug 1 — Invalid RelaxNG structure in the generated wrapper

**File:** `apps/desktop/src/sanmiaoSchemaMerge.ts`

The original wrapper tried to override TEI's `<date>` using:
```xml
<include href="tei_all.tei.rng">
  <except><define name="date"/></except>
</include>
<include href="ljb-sanmiao-dates.rng"/>
```
Three problems:
- RelaxNG has **no `<include><except>`** construct. `<except>` is invalid inside `<include>`.
- The empty `<define name="date"/>` is not a valid pattern.
- Because the exclusion didn't work, **both** files ended up defining `date` at
  the grammar's top level with no `combine` attribute — a hard RelaxNG compile
  error ("Some defines for date needs the combine attribute").

**Fix:** replace a definition in RelaxNG by placing the **override `<define>`
directly inside `<include>`** (this is the actual, spec-compliant override
mechanism):
```xml
<include href="tei_all.tei.rng">
  <define name="date"> ... </define>
</include>
```

**Verification:** `xmllint --noout --relaxng wrapper.rng doc.xml` against a
downloaded upstream `tei_all.rng` — confirmed `<date>` validates in `<p>` and
sanmiao children validate inside `<date>`.

## Bug 2 — Generated grammars had no namespace, so nothing in the TEI namespace matched

**File:** same

Even after fixing Bug 1, `<date>`/`<era>`/`<year>` etc. still failed, because
neither the wrapper grammar nor the patch grammar declared
`ns="http://www.tei-c.org/ns/1.0"`. Their `<element>` patterns therefore only
matched *no-namespace* elements, while real documents use the TEI namespace.

**Fix:** add `ns="http://www.tei-c.org/ns/1.0"` to both generated `<grammar>` roots.

## Bug 3 — The in-app schema manager only resolves the *first* `<include>`

**File:** `packages/cwrc-leafwriter/src/js/schema/schemaManager.ts` (consumer),
`apps/desktop/src/sanmiaoSchemaMerge.ts` (fix)

The wrapper had **two** `<include>` elements: the TEI core (with the date
override) and a separate `ljb-sanmiao-dates.rng` patch file with the
`ljb.sanmiao.*` helper defines. `schemaManager.ts`'s `loadSchema()` does:
```js
const include = $('include:first', this.schemaXML); // TODO add handling for multiple includes
if (include.length == 1) { await this.loadIncludes(schemaEntry, include); }
```
Only the first include is ever processed. The second include (helper defines)
was silently dropped. The date override's `<ref name="ljb.sanmiao.date.parts"/>`
then pointed at nothing, `xmlToJSON` returned `null` for the whole schema, and
`getParentsForTag` returned `[]` for **every** tag — not just date's children.
This is the "schema allows nothing, not even text in `<p>`" symptom from the
very first report.

**Gotcha:** `xmllint` accepts multiple includes fine, so RNG-level validation
passed even with this bug present. It only breaks the *in-app* schema manager.

**Fix:** collapse to a single `<include>` (TEI core, override inside it) and
**inline** the sanmiao helper defines as siblings of that include in the
wrapper grammar, instead of a second include file. Bumped
`SANMIAO_MERGE_VERSION` so `ensureSanmiaoDatesSchemaMerged` regenerates
existing (broken) wrappers from the preserved pristine `*.tei.rng` copy.

**Verification:** wrote `apps/desktop/src/sanmiaoSchemaMerge.test.ts` cases
asserting exactly one `<include>` and no dangling refs; also replicated
`schemaManager.ts`'s actual single-include merge logic against the real
project schema file in a throwaway script and confirmed `getParentsForTag('date')`
included `p` with zero dangling refs.

## Bug 4 — `documentSchemaUrl` prioritization hijacked include resolution

**File:** `packages/cwrc-leafwriter/src/js/schema/schemaManager.ts`

`loadSchemaFile()` is shared by the top-level schema load *and* by
`loadIncludes()`'s fetch of the include target. It always prioritizes
`this.documentSchemaUrl` if set:
```js
if (this.documentSchemaUrl && !urls.includes(this.documentSchemaUrl)) {
  urls = filterResourceUrls([this.documentSchemaUrl, ...urls]);
}
```
`documentSchemaUrl` gets set (from `xml2cwrc.ts`) whenever *any* document
opens, and — since `schemaManager` isn't recreated per project — persists
across project switches within the same running session. When it happened to
equal the wrapper's own URL, this logic hijacked the include fetch and
re-fetched the **wrapper** instead of the include target (`tei_all.tei.rng`).
The real 1MB TEI core was never loaded; the resulting schema was ~13KB with
the `<include>` tag still present (unresolved, now nested one level deeper)
and zero occurrences of `persName` anywhere.

**Fix:** added `{ prioritizeDocumentSchema, trackRng }` options to
`loadSchemaFile`; `loadIncludes()` now passes
`{ prioritizeDocumentSchema: false, trackRng: false }` so it always fetches
exactly the include's own URL and never lets that fetch clobber
`this.rng` (the tracked top-level schema URL used to resolve *future* includes).

**Verification:** `schemaManager.test.ts` — constructs a `SchemaManager` with
a fake writer, sets `documentSchemaUrl` to the wrapper's own URL (reproducing
the exact production sequencing), and asserts the include still resolves to
the real core content (`persName` present, no leftover `<include>` tag).
Confirmed the test fails without the fix and passes with it.

## Bug 5 — A second, independent include-merger also discarded the override

**File:** `packages/cwrc-leafwriter/src/utilities/fetchResource.ts` (`mergeRngIncludes`)

This is used by `localSchemaToBlobUrl`, which feeds the **worker-based salve
RelaxNG validator** (the one behind the checkmark/validation panel) — a
completely separate code path from `schemaManager.ts`. It correctly handles
multiple includes, but never looked at `<include>`'s own children (the
override `<define>`) before calling `includeEl.remove()` — silently
discarding the override and keeping the stock upstream `date` define
unchanged. This explains why auto-tagging (driven by `schemaManager.ts`,
already fixed) started working while the separate validation panel kept
reporting "era/year/... not allowed in date" using the stock TEI
documentation string.

**Fix:** before merging an included grammar's children into the main
document, first apply `<include>`'s own child `<start>`/`<define>` overrides
onto the fetched grammar — mirroring the logic already fixed in
`schemaManager.ts`.

**Verification:** `fetchResource.test.ts` — feeds a wrapper+core pair through
`localSchemaToBlobUrl`, parses the resulting blob, and asserts the merged
`date` define contains the override's ref and *not* the stock `model.phrase`-only
content. Confirmed fails without the fix, passes with it.

## Bug 6 — Validator worker caches the compiled grammar by id alone, ignoring the URL

**File:** `packages/cwrc-leafwriter-validator/src/virtualEditor.ts`

```js
async initialize({ id, url }) {
  if (this.schemaId === id) return { success: true }; // BUG: ignores url
  ...
}
```
`id` is the catalog id (e.g. `"teiAll"` or a project-specific
`"project-tei-all"`), which is the **same** across `initialize()` calls even
when the underlying schema content differs (fresh blob URL each time for
local/project schemas). Once this worker instance initializes for any id, it
silently ignores every later `initialize()` call with the same id — even with
a brand-new blob URL — for the rest of that worker's lifetime.

**Fix:** track `schemaUrl` alongside `schemaId`; only skip reprocessing when
**both** match. Reset both in `reset()`.

**Verification:** `virtualEditor.test.ts` — calls `initialize()` twice with
the same id but different urls (simulating two different projects sharing a
catalog id) and asserts the grammar is reprocessed for the second call, not
silently reused from the first. Confirmed fails without the fix.

## Bug 6.5 — Stale build artifacts (not a code bug, but cost significant time)

Two separate build-freshness traps compounded the above:

1. `packages/cwrc-leafwriter-validator`'s `dist/leafwriter-validator.worker.js`
   (a **separately-built, non-watched** artifact — `npm run build` runs
   `tsup && tsc && webpack`, not part of the `npm run dev` watch loop) was 10
   days stale. `apps/commons/webpack.config.ts`'s `CopyPlugin` copies straight
   from that `dist/` into `apps/commons/public/`, so the served worker script
   never picked up any of the above fixes until the validator package was
   manually rebuilt (`npm run build` in `packages/cwrc-leafwriter-validator`)
   and the output re-copied into `apps/commons/public/`.
2. A one-time install script
   (`packages/cwrc-leafwriter/bin/install_worker.js`) copies the compiled
   worker using `fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL)` —
   which **refuses to overwrite** an existing destination file. This is why
   the served file didn't update even after some rebuilds.

**Diagnostic technique:** fetched the served bundle directly from the
DevTools console (`fetch(scriptSrc).then(r=>r.text())`) and grepped for a
variable name unique to each fix, to distinguish "code is wrong" from "browser
is running old code" without guessing.

## Bug 7 — `validate()` never re-initializes; worker lifecycle race

**File:** `packages/cwrc-leafwriter/src/overmind/validator/actions.ts`

Even with the schema merge and worker caching fully fixed, live testing kept
showing stale (stock TEI) validation results. Direct console reproduction
proved, definitively, that a manually-triggered `initialize()` call produced
a 100%-correct compiled grammar (verified via `getValidNodesAt` showing `era`
etc. as valid children of `date`, and via directly fetching and parsing the
exact blob URL passed to the worker). Yet the very next `validate()` call —
whether triggered by the UI or by console — used stale, unmerged results.

Root cause: `validate()` never calls `initialize()` itself; it just uses
whatever schema state `window.leafwriterValidator` (a **module-global
singleton reference**) already has. That reference gets **replaced** by a
brand-new `Worker` every time `loadValidator()` runs (called from
`writerInitSettings`, itself invoked from `App.tsx`'s `setup()` — which can
re-run more than once per session, e.g. on project/document switches). A
freshly-spawned worker has no memory of any previous worker's schema load.
`state.validator.hasSchema` is an Overmind flag that doesn't distinguish
*which* worker instance it was set for, so it can remain `true` even after
the underlying worker has been silently swapped for an uninitialized one.

**Fix, part A:** `loadValidator()` now resets `state.validator.hasSchema = false`
immediately after spawning a new worker, and immediately calls
`actions.validator.initialize()` right after — so a fresh worker is never left
in a state where `hasSchema` lies about what it actually has loaded.

**Fix, part B (belt and suspenders):** `validate()` itself now calls
`actions.validator.initialize({ silent: true })` before validating, every
time — cheap when nothing changed, since `virtualEditor`'s own id+url guard
(Bug 6's fix) skips reprocessing in that case.

**Regression this introduced and fixed:** `initialize()` publishes a
`workerValidatorLoaded` event on completion; the validation panel
(`packages/cwrc-leafwriter/src/js/layout/panels/validation/index.ts`)
subscribes to that event and calls `validate()` in response. Once `validate()`
itself started calling `initialize()`, this created an infinite loop:
`validate → initialize → publish workerValidatorLoaded → panel calls validate
→ initialize → publish → ...`. Fixed by adding a `{ silent?: boolean }` second
parameter to `initialize()`; `validate()`'s internal call passes
`{ silent: true }` to suppress the event, while the two pre-existing callers
(`loadValidator`, `schemaManager.processSchema`'s `sendSchemaToWorkerValidator`)
keep the normal (non-silent) behavior, since those genuinely represent
"worker or schema just became ready" and should still notify the panel once.

**Status at time of writing:** fix applied and typechecked; loop confirmed
fixed (panel is no longer stuck refreshing); the original 542-error count had
not yet been re-verified live after this specific fix when this log was written.

## Diagnostic techniques that worked (reusable)

- **`xmllint --noout --relaxng wrapper.rng doc.xml`** catches RNG structural
  bugs (Bugs 1–2) but is blind to bugs in the app's own include-resolution
  code (Bugs 3–6), since `xmllint` has its own, different (correct, spec
  compliant) include handling.
- **Reimplementing the suspect merge logic inline in the DevTools console**,
  reading real project files via `window.electronAPI.readFile`, to test the
  *logic* in isolation from *deployment* (bundling/caching/lifecycle)
  concerns. This proved the merge logic was correct well before the
  deployment-layer bugs (6.5, 7) were found.
- **Fetching the served bundle from the console** (`fetch(src).then(r=>r.text())`)
  and grepping for a variable/string unique to a fix, to conclusively
  distinguish "stale build" from "wrong code" without guessing.
- **Calling the real Comlink-wrapped worker API directly**
  (`window.leafwriterValidator.getValidNodesAt(...)`) to test the actual
  compiled grammar's behavior, bypassing the app's own UI-triggered validate
  flow entirely — this is what finally proved the pipeline was correct and
  isolated the remaining bug to *when/how often* `initialize()` runs, not
  *what* it produces.
- **Adding temporary `console.log` instrumentation directly into the real
  action** (`overmind/validator/actions.ts`), rebuilding, and observing the
  natural (non-manually-triggered) call sequence during a real boot — this
  revealed the two-phase initialize() sequence (early bootstrap with
  `schemaId: undefined`, then the real project-specific call) and confirmed
  the automatically-created blob was correct, narrowing the remaining bug to
  the validate/initialize relationship (Bug 7).

## Files changed

- `apps/desktop/src/sanmiaoSchemaMerge.ts` (+ test) — Bugs 1, 2, 3
- `packages/cwrc-leafwriter/src/js/schema/schemaManager.ts` (+ test) — Bug 4
- `packages/cwrc-leafwriter/src/utilities/fetchResource.ts` (+ test) — Bug 5
- `packages/cwrc-leafwriter-validator/src/virtualEditor.ts` (+ test) — Bug 6
- `packages/cwrc-leafwriter/src/overmind/validator/actions.ts` — Bug 7
- Also fixed in the same session but unrelated to schema validation:
  `apps/desktop/src/preload.ts` (broken `@src` import aliases),
  `apps/desktop/src/projectFile.ts` and
  `packages/cwrc-leafwriter/src/autoTagging/entityStoreResolve.ts` (entity
  store defaulted to `'central'` even for brand-new projects with no central
  folder configured), `apps/commons/src/desktop/useCommonsUiBridge.ts`
  (offer to scaffold a new entity database when picking an empty root folder).
