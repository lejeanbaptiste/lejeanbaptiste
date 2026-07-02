# Translation Mode — Phased Implementation Plan

**Status:** Phase A implemented (settings/storage foundation). Phase B implemented and revised after in-app testing:
- Translation languages + alignment unit are configured in the **Edition metadata** dialog (not a separate modal) — see the "Translation" section in `NativeProjectMetadataPage.tsx`, persisted via `translationSettings.ts`.
- The **Translation tab is persistent** in the right panel (`UnifiedRightPanel.tsx`), alongside File Metadata/Attributes/etc., like Attributes — not conditionally shown.
- `TranslationTabContent.tsx` owns the language dropdown and auto-indexes (bootstraps xml:id + creates the companion file) the first time the tab is active for a given (file, language) pair — fully automatic, no confirmation dialogs.
- The toolbar's translate icon just switches to that tab (`window.__desktopRightPanel.showTab('translation')`).
- `TranslationPane` (cwrc-leafwriter package) still renders the actual per-unit editing surface, portaled into the tab's `#desktop-panel-translation` mount point via `App.tsx`.
- Fixed: `splitParagraphAtCaret` (`tagInsert.ts`) now inserts a fresh empty sibling paragraph (no id copied) instead of extracting-and-splitting when the caret is at the very end of a paragraph — fixes both the "can't split at the end" bug and avoids duplicate `xml:id`s at the source.
- Added: `reindexTranslationOnSave` (`translationEntry.ts`) — runs automatically after every file save (gated on the Translation tab being open, via `window.__desktopTranslationTabActive`, to cost nothing otherwise). Silently fixes duplicate/missing ids from any other cause (e.g. copy-paste) and resyncs every configured language's companion file, preserving existing translated content by `@corresp` match.

Phase C implemented:
- XPath search (`searchXPath.ts`) now excludes companion translation files from `project`/`custom` scope enumeration, and refuses `currentFile`/`openTabs` scope if the target is a translation file — XPath only makes sense against schema-validated documents.
- Find/Replace (`searchText.ts`) already included translation files by virtue of an unfiltered file crawl. Added a second "Documents" scope dropdown (Source / Translation / Both) in `SidebarFindTab.tsx`, threaded through `searchText`/`useFindReplace` via `docScope.ts`, so results (and replace-all) can be restricted independently of the existing currentFile/openTabs/project/custom scope.
- Clicking a Find result inside a translation file (`translationHitJump.ts`, `useTranslationHitJump.ts`) opens the source file, switches the right panel to the Translation tab, requests the matching language (`desktop:translation-request-language` event, handled in `TranslationTabContent.tsx`), and best-effort selects the source paragraph the match falls in (by walking up from the matched XML node to the nearest `@corresp` ancestor, then selecting that `xml:id` in the source editor) — so source and translation end up shown side by side at the right unit.

Phase C additions (after in-app testing):
- Find panel has a second "Documents" scope dropdown (Source / Translation / Both) — `docScope.ts`, threaded through `searchText.ts`/`useFindReplace.ts`. `currentFile`/`openTabs` scope also fetches companion files directly from disk (they're never open as tabs) via `translationCompanionResults.ts`.
- Clicking a translation-file Find result (`useTranslationHitJump.ts` + `translationHitJump.ts`) opens the source, switches to the Translation tab, requests the language, selects the source unit (focusEditor=false so panel keyboard nav survives), and highlights the exact matched occurrence in the pane by decoded-character offset (`desktop:translation-highlight-text` event).

Phase D implemented:
- `translationCompanionOps.ts` (`findCompanionTranslationFiles`) — thin resolver: expected companion paths from the naming convention × configured languages, filtered by on-disk existence. No manifest.
- Rename/move/delete cascade in `renameExplorerItem`/`moveExplorerItem`/`deleteExplorerItem` (overmind actions layer, which has project context) — companions follow the source silently; per-companion failures warn to console without failing the main operation. Directory operations don't cascade (companions inside move/delete with the directory itself).

Phase E implemented: deleted `packages/cwrc-leafwriter/src/js/dialogs/translation.ts`, its `dialogManager` registration, and the now-unused `iso-639-2` dependency. The toolbar's translate icon survives and opens the Translation tab. **All phases (A–E) complete.**
**Scope:** Desktop app — parallel source/translation editing, companion-file storage, project-level alignment setting.
**Related:** `docs/todo.md`

---

## Context

Leaf-writer (a TEI/Orlando XML scholarly editor) has a broken, half-built "translate" toolbar button today: it hard-requires a `<div>` selection and, when it works, just splices a `<div type="translation" xml:lang="...">` sibling with raw pasted text into the *same* document — no tracking of which paragraph maps to which, no separate file, no reuse across languages. It has never worked for the user in practice (selection-type mismatch), and its data model is a dead end for what's actually wanted.

The goal is a proper **translation mode**: a project-level feature where each source XML file can have one or more language translations, edited in a split-pane view, explicitly linked at a user-chosen granularity (paragraph or div), stored as companion files rather than inline markup, with basic rich-text formatting but not full entity tagging inside translation content. This plan replaces the old dialog entirely (icon kept, behavior replaced) and lands as a foundation-first, incrementally shippable sequence of phases.

## Agreed design decisions (binding — do not re-litigate during implementation)

1. **Project-level setting**, written once and then largely locked: `alignmentUnit: 'div' | 'p'` (chosen on first use, immutable after) and `languages: [{code, label}]` (an open, appendable list — new languages can be added anytime). Stored in `schema/translation-settings.json`, mirroring `schema/project-metadata.json`.
2. **Storage:** one companion file per (source file × language), living next to the source file by naming convention: `chapter1.xml` → `chapter1.fr.translation.xml`. Never inline in the source document.
3. **Linking:** `xml:id` + `@corresp`. On first "Start Translation" for a source file, every element at the alignment-unit level gets an `xml:id` if missing (mutates the source — requires a one-time user confirmation, in the spirit of the existing schema-update confirmation flow). The companion file's aligned-unit elements carry `@corresp="chapter1.xml#<id>"`.
4. **Structural mirroring:** the companion file mirrors the source's structural shell (divs/sections/headings) exactly down to and including the alignment-unit level. Content *inside* the unit is free-form and untracked below that level — this is what makes `div`-level alignment actually looser/useful than `p`-level.
5. **UI:** split-pane, but only ever showing the translation of the *currently selected* alignment unit (no full-document parallel scrolling/reordering to keep in sync — explicitly ruled out as unnecessary complexity).
6. **Translation pane supports basic rich-text formatting** (bold/italic/underline — whatever inline marks the schema already supports, e.g. TEI `<hi rend="...">`), but **not** full entity/attribute tagging. This keeps it a lightweight second text surface rather than a second full CWRC tagging instance.
7. **Find/xpath/tagging get a scope selector**: Source / Translation:[lang] / All. Since translations are separate documents, this mostly reuses existing per-document search machinery.
8. **Footnotes are independent per document** for v1 — no automatic cross-linking between source and translation notes.
9. **File lifecycle cascading is new territory**: renaming/moving/deleting a source file must cascade to its companion file(s). No existing precedent for cross-file cascades in the codebase today — every file op is currently fully independent.
10. **Old inline dialog is scrapped, icon kept.** `packages/cwrc-leafwriter/src/js/dialogs/translation.ts` and its `dialogManager` registration are deleted; the toolbar's `translate` icon is repointed to the new entry flow.
11. **Explicit non-goal:** no automatic sentence/paragraph alignment tooling (no Hunalign-style auto-aligner). Links are only ever created by a human authoring a translation unit.

## Reused existing patterns (do not reinvent)

- **Settings dialog pattern** to clone: `apps/commons/src/pages/project/NativeProjectMetadataPage.tsx`, `apps/commons/src/desktop/projectMetadata.ts` (`readProjectMetadata`/`writeProjectMetadata`, ensures `schema/` dir, updates project config pointer), `apps/commons/src/desktop/useNativeDialogBridge.ts` (`saveProjectMetadata` ~line 264), menu wiring via `apps/desktop/src/main.ts` (~line 280) → `apps/commons/src/desktop/useProjectMenu.ts` (~line 136).
- **Project config types**: `apps/commons/src/desktop/projectTypes.ts` — `ProjectFileConfig`, `PROJECT_FILE_NAME`, `DEFAULT_METADATA_PATH` pattern.
- **Generic file I/O**: `apps/desktop/src/main.ts` `readFile`/`writeFile` handlers (~413-419), `apps/desktop/src/preload.ts` (~49-50, 122-124) — no special-casing by file type; translation files/settings JSON go through the same `electronAPI.readFile`/`writeFile`.
- **xml:id handling**: `apps/commons/src/desktop/tagging/attributeIdHelpers.ts` (`findDuplicateSchemaIdInDocument`) — reuse for collision-safe id generation.
- **DOM-based XML processing, no custom AST**: `packages/cwrc-leafwriter/src/js/conversion/xml2cwrc.ts` / `cwrc2xml.ts`; `<standOff>` extraction there is a precedent for handling auxiliary XML structures.
- **Editor mode state machine** (model, not literal reuse — see Phase B rationale): `packages/cwrc-leafwriter/src/overmind/ui/state.ts:15` (`editorViewMode`), `.../ui/actions.ts:270` (`setEditorViewMode`), `packages/cwrc-leafwriter/src/js/layout/layoutManager.ts:296` (DOM visibility toggling).
- **Split-pane layout already exists**: `packages/cwrc-leafwriter/src/layout/index.tsx` uses `react-resizable-panels` (`PanelGroup direction="horizontal"`, `Section side="left"/"right"`, `ResizeHandle`) — reuse this mechanism for the source|translation split rather than building new resizable-pane logic.
- **New-file-creation precedent** (partial fit only): `apps/commons/src/overmind/project/actions.ts` `newFile()` (~432-503), `saveActiveTabAs()` (~735) + `reloadDirectoryInTree()`. Companion files are not normal user-facing tabs, so this precedent is adapted, not directly reused.
- **Explorer listing**: `apps/desktop/src/explorerFileOps.ts` `listProjectXmlFiles()` — needs a companion-aware filter so translation files don't clutter the main tree.

---

## Phase A — Project settings + storage model (foundation)

**Goal:** persist the locked setting, define naming/linking rules, provide read/write/bootstrap primitives everything else builds on. No split-pane UI yet.

1. **Types** — new `apps/commons/src/desktop/translationTypes.ts`:
   - `TranslationSettingsFile { version: 1; alignmentUnit: 'div' | 'p'; languages: Array<{ code: string; label: string }>; lockedAt: string }`
   - `DEFAULT_TRANSLATION_SETTINGS_PATH = 'schema/translation-settings.json'`
   - Add optional `translationSettings?: string` pointer to `ProjectFileConfig` in `projectTypes.ts` (same slot pattern as `metadata?: string`).

2. **Read/write module** — new `apps/commons/src/desktop/translationSettings.ts`, mirroring `projectMetadata.ts`:
   - `readTranslationSettings(bundle)` → `null` if the feature hasn't been enabled for this project yet.
   - `writeTranslationSettings(bundle, draft)` — write-once for `alignmentUnit` (reject if a settings file already exists and `alignmentUnit` differs); reuse whatever dir-ensure helper `projectMetadata.ts` uses for `schema/`.
   - `addTranslationLanguage(bundle, {code, label})` — additive-only, always allowed even after lock.

3. **Companion-file naming module** — new `apps/desktop/src/translationFileNaming.ts` (co-located with `explorerFileOps.ts`, which already does this kind of path math):
   - `translationFilePathFor(sourcePath, langCode)` — `chapter1.xml` → `chapter1.fr.translation.xml`.
   - `parseTranslationFilePath(p)` → `{ sourceFileName, lang } | null`.
   - `isTranslationFile(p)`.
   - Test: `translationFileNaming.test.ts` (round-trip, dotted filenames, case sensitivity).

4. **xml:id bootstrap module** — new `apps/commons/src/desktop/translationBootstrap.ts` (pure DOM, no Electron dependency, directly unit-testable):
   - `findAlignmentUnitsMissingIds(doc, alignmentUnit)`.
   - `assignMissingIds(doc, elements)` — reuses `findDuplicateSchemaIdInDocument` for collision-safe generation.
   - `createTranslationShell(sourceDoc, sourceFileName, lang, alignmentUnit)` — clones the structural shell down to and including each alignment-unit element, stamps `@corresp` on each, leaves unit content empty for free-form authoring.
   - Test: `translationBootstrap.test.ts` (missing-id detection, collision-avoidance, shell-cloning fidelity).

5. **One-time source-mutation confirmation dialog**: locate the existing schema-update confirmation flow (near `apps/desktop/src/checkSchemaUpdate.ts` / its paired UI) and clone its shape for: *"Starting translation will add xml:id attributes to N elements in chapter1.xml. Continue?"* — shown only when `findAlignmentUnitsMissingIds` is non-empty.

**Phase A critical files:** `apps/commons/src/desktop/translationTypes.ts` (new), `translationSettings.ts` (new), `apps/desktop/src/translationFileNaming.ts` (new), `apps/commons/src/desktop/translationBootstrap.ts` (new), `apps/commons/src/desktop/projectTypes.ts` (add pointer field).

---

## Phase B — Settings dialog + "Start Translation" entry flow + split-pane UI

**Goal:** configure the project setting once, enter translation mode per file/language, view source + translation side by side for the selected unit, with basic rich-text formatting on the translation side.

1. **Translation Settings dialog** (clone of the metadata-dialog pattern):
   - New `apps/commons/src/pages/project/NativeTranslationSettingsPage.tsx` — alignment-unit radio (disabled once locked), language list editor (add/remove rows; block removing a language that already has companion files on disk — a Phase B warning is enough, no hard enforcement needed yet).
   - `useNativeDialogBridge.ts` — add `saveTranslationSettings`, calling Phase A's write functions.
   - Menu wiring in `apps/desktop/src/main.ts` (near existing project-metadata entry) → `useProjectMenu.ts` — new "Translation Settings…" project-menu item, shown only when a project is open.

2. **Editor mode state** — add an **independent** state field rather than widening `editorViewMode`:
   - `packages/cwrc-leafwriter/src/overmind/ui/state.ts` — `translationMode: { active: boolean; lang: string | null; sourcePath: string | null; translationPath: string | null; selectedUnitId: string | null }`. Kept separate from `'visual' | 'source'` because translation mode is a layout overlay on top of visual mode, not a third mutually-exclusive mode — conflating them would force tri-state branching everywhere `editorViewMode` is currently checked.
   - `.../ui/actions.ts` — `enterTranslationMode({lang})` / `exitTranslationMode()`, modeled on `setEditorViewMode`. `enterTranslationMode` resolves/creates the companion file via Phase A's naming + bootstrap (showing the confirmation dialog if ids are missing), then sets `selectedUnitId` from whatever alignment-unit element currently contains the cursor.

3. **Toolbar icon repoint** — `packages/cwrc-leafwriter/src/components/editorToolbar/index.tsx:182-189`:
   - No translation settings yet → clicking opens the Translation Settings dialog (bootstraps first-time use).
   - One configured language → directly dispatch `enterTranslationMode({lang})`.
   - Multiple languages → small popover/menu listing them, each dispatching `enterTranslationMode`.
   - Already active → dispatch `exitTranslationMode()`.

4. **Split-pane UI** — reuse `PanelGroup`/`Section`/`ResizeHandle` from `packages/cwrc-leafwriter/src/layout/index.tsx`:
   - New `packages/cwrc-leafwriter/src/layout/TranslationPane.tsx`. Given the "basic formatting, not full tagging" decision: this pane hosts a **lightweight TinyMCE instance** configured with only a small inline-formatting toolbar (bold/italic/underline, mapped to whatever inline element the schema already defines — e.g. TEI `<hi rend="...">`), *not* a second full CWRC tagger/entity-widget instance. This avoids needing a "which writer instance has focus" resolver for tagging commands — tagging commands stay scoped to the single main `window.writer`; the translation pane is a simpler, self-contained rich-text widget with its own serialize-on-blur logic.
   - Wire into `Layout`: when `state.ui.translationMode.active`, render `<TranslationPane />` in the right `Section` slot (temporarily superseding whatever utility panel was open there).
   - Selection sync: a selection-change listener on the main editor (reuse whatever hook the entity/attribute widgets already use for this — locate under `packages/cwrc-leafwriter/src/js/`) updates `selectedUnitId`; `TranslationPane` re-renders to the element whose `@corresp` matches.
   - Saving: edits serialize back into the companion `Document` (replacing the matching `@corresp` element's inline content) and persist via `electronAPI.writeFile`, on blur or a short debounce.

**Phase B critical files:** `packages/cwrc-leafwriter/src/overmind/ui/state.ts`, `.../ui/actions.ts`, `packages/cwrc-leafwriter/src/components/editorToolbar/index.tsx`, `packages/cwrc-leafwriter/src/layout/index.tsx` (+ new `TranslationPane.tsx`), `apps/commons/src/pages/project/NativeTranslationSettingsPage.tsx` (new).

---

## Phase C — Find / XPath / Tagging scoping

**Goal:** add a Source / Translation:[lang] / All scope selector to existing search/xpath tooling.

1. First implementation step: locate the actual find/xpath dialog components (`grep -rn "xpath\|FindReplace" packages/cwrc-leafwriter/src`) — not yet enumerated, confirm exact files before editing.
2. Add `TranslationScope = { kind: 'source' } | { kind: 'translation'; lang: string } | { kind: 'all' }` (new `packages/cwrc-leafwriter/src/types/translationScope.ts`) and a scope dropdown in the find/xpath UI, populated from translation settings.
3. `source` scope: unchanged, operates on `window.writer`'s current document. `translation:{lang}` scope: load the companion file into a detached `DOMParser` document (reusing `xml2cwrc.ts` patterns) since it isn't necessarily open in a tab. `all`: run both, tag results by origin document.
4. Because the translation pane (per Phase B's scope decision) is a lightweight rich-text widget rather than a full tagger instance, tagging commands stay targeted at the single main `window.writer` — no focus-resolution subsystem needed. Find/replace within the translation pane's own content can be a simpler text-level operation scoped to that pane, separate from the main xpath/tagging machinery.

**Phase C critical files:** find/xpath dialog files (locate via grep), `packages/cwrc-leafwriter/src/types/translationScope.ts` (new), `packages/cwrc-leafwriter/src/js/conversion/xml2cwrc.ts` (reused for detached parsing).

---

## Phase D — File lifecycle cascading (rename/move/delete)

**Goal:** minimal mechanism so source-file rename/move/delete cascades to companions, without a new generic "linked files" subsystem.

1. New `apps/desktop/src/translationCompanionOps.ts`:
   - `findCompanionTranslationFiles(sourcePath, languages: string[])` — pure/testable: for each configured language, compute the expected companion path via `translationFilePathFor`, `fs.access` to confirm existence, return the ones that exist. No manifest/index file — naming convention is the sole source of truth.

2. **Rename cascade**: orchestrated at `apps/commons/src/overmind/project/actions.ts` `renameExplorerItem` (~line 997), which already has `state.project` (hence languages) in scope. Low-level `explorerFileOps.ts` `renamePath` stays translation-agnostic; the overmind action sequences: rename source → compute+rename each companion to its new expected name → `repathOpenTabsForMove` for source and any open companion tabs.
3. **Move cascade**: same shape in `moveExplorerItem` (~line 1030) — companions move to the same `destDir`, filenames unchanged.
4. **Delete cascade**: `deleteExplorerItem` (~line 1058) — delete companions before/with the source; update the existing delete-confirmation copy to mention "and its N translation file(s)" when companions exist.
5. **Explorer tree display**: `listProjectXmlFiles()` should exclude companion files from the main tree (`isTranslationFile` filter) — v1 keeps them invisible in the general explorer, fully accessible only through Translation Mode. Avoids new tree-grouping UI in this pass; revisit later if visibility is wanted.

**Phase D critical files:** `apps/desktop/src/translationCompanionOps.ts` (new), `apps/desktop/src/explorerFileOps.ts`, `apps/commons/src/overmind/project/actions.ts`.

---

## Phase E — Remove old inline translation dialog

**Goal:** delete the superseded code once Phase B's entry point is verified working, avoiding a window with no working translate entry point.

1. Delete `packages/cwrc-leafwriter/src/js/dialogs/translation.ts` in full.
2. Remove its `dialogManager` registration (`defaultDialogs` Map entry `['translation', { dialogClass: Translation }]`, ~line 172 of `dialogManager.ts`) and the now-unused import.
3. `grep -rn "iso-639-2" packages apps` — if only the deleted dialog used it, remove the dependency from `package.json`.
4. `grep -rn "dialogManager.show('translation')"` — confirm no other call sites before deleting.
5. Land this only after Phase B is manually verified working end-to-end.

**Phase E critical files:** `packages/cwrc-leafwriter/src/js/dialogs/translation.ts` (delete), `packages/cwrc-leafwriter/src/js/dialogs/dialogManager.ts` (remove registration).

---

## Sequencing

- **A** is a hard prerequisite for B, C, D.
- **B** must land before **E** (new destination must exist before the old one is removed).
- **C** can start in parallel with the back half of B once A's settings shape is stable.
- **D** depends only on A and can proceed in parallel with B/C.
- **E** is last, gated on B being verified working.

---

## Verification plan

### Manual end-to-end flows
1. **First-time settings lock**: configure alignment unit `div`, languages `fr`+`de`; reopen dialog, confirm `alignmentUnit` is now read-only, languages remain add-able.
2. **Start Translation, ids missing**: pick `fr` on a file with no `xml:id`s on its divs; confirm the confirmation dialog appears; accept; verify source now has ids and `chapter1.fr.translation.xml` exists with mirrored shell + correct `@corresp`.
3. **Start Translation, ids already present**: repeat for `de` on the same file — no confirmation dialog the second time, independent companion file created.
4. **Split-pane authoring**: click into different divs in source; translation pane swaps to the matching unit each time; type bold/italic text, confirm it round-trips through the schema's inline formatting element; blur, reload the companion file from disk, confirm persistence at the correct `@corresp` element.
5. **Toolbar re-entry/exit**: click translate icon again while active — exits cleanly; with 2+ languages, confirm the picker appears (not the old dialog).
6. **Find/xpath scoping**: scope=Source only matches source; scope=Translation:fr matches the companion file even when it's not open as a tab; scope=All matches both, distinguishable by origin.
7. **Rename cascade**: rename `chapter1.xml`; confirm both companions rename to match, and open tabs (source or companion) repath correctly.
8. **Move cascade**: move the source into a subfolder; companions follow.
9. **Delete cascade**: delete the source; confirmation mentions the companion count; all files gone after confirming.
10. **Old dialog removal**: `dialogManager.show('translation')` no longer resolves; toolbar icon never opens the old dialog under any path.

### Automated test seams
- `apps/commons/src/desktop/fileMetadata.test.ts` — precedent to mirror for `translationSettings.test.ts` (round-trip, write-once lock, additive language append) and `translationBootstrap.test.ts` (id-assignment collision-avoidance, shell-cloning fidelity).
- New `translationFileNaming.test.ts` — pure string-transform round-trips (cheap, high-value given Phase D's cascade logic depends on it being exactly right).
- New `translationCompanionOps.test.ts` (Phase D) — temp-dir fixture verifying rename/move/delete cascades, including "no companions exist" and "zero configured languages" no-op cases.
- Check for an existing schema-update-confirmation test near `checkSchemaUpdate.ts` to mirror for the new xml:id-confirmation flow's underlying logic (`findAlignmentUnitsMissingIds`/`assignMissingIds`, already covered above).
