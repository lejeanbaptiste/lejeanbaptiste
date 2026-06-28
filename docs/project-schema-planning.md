# Project schema & onboarding — implementation plan

**Status:** Planning complete (**#15** and **#18** locked); ready for implementation  
**Scope:** Desktop app — Open Project + schema setup, project metadata, New File skeleton, schema update alerts  
**Related:** `docs/schema_handling.md` (original vision), `docs/todo.md`, `docs/tagging-planning.md`, `docs/versioning-planning.md`

---

## Summary

**Open Project** (IDE-style) opens or creates a folder, ensures a local schema in `schema/`, collects **project-wide metadata**, then loads the project. There is no separate “New Project” menu item.

After the user picks a schema (first-time setup only), a **Project metadata** dialog appears. Fields are defined by the schema catalog entry; the user can add custom fields at the bottom. Values are stored in **`schema/project-metadata.json`** (portable with the schema folder). Blanks stay blank — they are not written into defaults and are omitted from new files until set per document.

**App Settings** includes the user’s **encoder name**, pre-filled in the metadata dialog when creating a new project (user can clear or override for that project). Changing Settings does not rewrite existing projects.

**New File** (⌘N) merges project metadata defaults into a schema-valid skeleton (plus per-file `Untitled` title). Temp file + Save As flow unchanged.

**Project → Edition metadata…** re-opens the dialog anytime. Saving changed defaults prompts whether to **apply to existing XML files** (confirmed, never silent).

**Schema download picker** reuses the existing LEAF-Writer catalog (`packages/cwrc-leafwriter/src/config/schemas.ts` + `schemasList` in the editor)—no duplicate menu. **v1** enables **TEI All** and **TEI Lite** for download, metadata fields, and New File skeletons; other catalog entries appear under **More schemas…** (disabled or phased) until templates and field maps ship. **Use local schema file…** is always available.

**Per-file metadata** lives in a **right-hand panel** (LEAF-Writer east rail), first icon in the icon strip, **default panel when a file opens**. **Edition metadata** (project-wide) stays **Project → Edition metadata…** dialog. Right-rail tabs use **icons instead of text labels** where space is tight.

---

## Why this approach

| Approach | Pros | Cons |
|----------|------|------|
| Online URLs only (current default) | Small app; always “latest” TEI | Needs network; not reproducible; offline failures |
| Pre-bundle everything in the app | Offline first launch | ~24–40 MB redundant; app updates tied to TEI releases |
| **Copy into project on open/setup (chosen)** | Self-contained; offline; DH best practice; ~1–3 MB per project | One-time download; update UX to maintain |

Modern TEI P5 RelaxNG releases ship **monolithic** `.rng` files (~1 MB each), so copy-on-setup is a single-file download per schema.

---

## What already exists

| Capability | Status | Where |
|------------|--------|-------|
| Built-in schema catalog | Done | `packages/cwrc-leafwriter/src/config/schemas.ts` |
| Schema picker UI | Done | `SelectSchemaDialog`, `NativeSchemaPickerPage` |
| Project file + `schema/` detection | Done | `apps/*/src/desktop/projectFile.ts` |
| Resolve local schemas when opening files | Done | `resolveDocumentSchemas.ts` |
| RelaxNG validation | Done | `@cwrc/leafwriter-validator` |
| SHA-256 hash for remote schema changes | Done | `cwrc-leafwriter-validator/src/conversion.ts` |
| Desktop Settings (locale, theme, warnings, encoder name) | Done | `NativeSettingsPage`, `project-prefs.json` |
| **Open Project + schema setup wizard** | **Done (Phase 1)** | `NativeSchemaSetupPage`, `schemaSetup.ts`, `openProject` onboarding |
| **Project metadata dialog + JSON** | **Done (Phase 1)** | `NativeProjectMetadataPage`, `projectMetadata.ts` |
| **Apply metadata to existing files** | **Done (Phase 1)** | Edition metadata → Save and update documents… |
| **New File (⌘N) + skeleton merge** | **Done (Phase 2)** | `project/actions.ts` `newFile`, `schemaTemplates.ts`, `mergeMetadataIntoHeader` |
| **Temp file + Save As flow** | **Done (Phase 2)** | Save redirects temp tabs to Save As; explorer default directory; temp close prompt + cleanup |
| **Phase 1 smoke test** | **Done (June 2026)** | `docs/smoke_test.md` |
| **Phase 2 smoke test** | **Ready for manual pass** | `docs/smoke_test.md` section I |
| **Schema update alert** | **Not done** | — |

---

## Target project layout

```
my-edition/
  jean-baptiste.project.json
  schema/
    tei_all.rng
    tei.css
    project-metadata.json       # edition-wide header defaults (portable)
    _archive/                   # on schema update only
      tei_all-4.11.0.rng
  … user XML anywhere in tree …
```

- **`schema/`** (singular) — RNG, CSS, and **`project-metadata.json`** travel together; copy this folder to seed a new project.
- **No fixed `documents/` folder** — XML can live anywhere; Save As chooses location.
- **Temp new files** — app temp dir until Save As; **prompt** (Save / Don’t save / Cancel) when closing an unsaved temp tab; cleaned on discard or after Save As.

---

## Project file + metadata JSON

### `jean-baptiste.project.json` (extended)

```typescript
export interface ProjectSchemaConfig {
  rng: string;
  css?: string;
  catalogId?: string;
  sourceUrl?: string;
  sourceCssUrl?: string;
  sourceHash?: string;
  sourceCssHash?: string;
  installedVersion?: string;
  installedAt?: string;
  lastCheckedAt?: string;
}

export interface ProjectFileConfig {
  version: 1;
  name: string;
  schema?: ProjectSchemaConfig;
  /** Relative path, default schema/project-metadata.json */
  metadata?: string;
}
```

Parse `installedVersion` from the `.rng` comment, e.g. `TEI Edition: P5 Version 4.11.0`.

### `schema/project-metadata.json`

```typescript
export interface ProjectMetadataFile {
  version: 1;
  /** Matches schema catalog entry when installed from catalog */
  catalogId?: string;
  /** Managed fields: TEI path → value. Omitted keys = blank default. */
  fields: Record<string, string>;
  /** User-added rows from dialog footer */
  custom: Array<{ path: string; label: string; value: string }>;
}
```

Field paths are **TEI element paths** relative to `teiHeader` (e.g. `encodingDesc/projectDesc/p`, `publicationStmt/availability/licence`). Which paths appear in the dialog is defined per catalog entry / mapping — not by parsing the full RelaxNG at runtime (v1).

---

## Locked design decisions

### Open Project (replaces separate “New Project”)

| # | Decision |
|---|----------|
| — | **File → Open Project…** only; picker may create a new folder. |
| — | On open: scan for `schema/*.rng` and/or `jean-baptiste.project.json`. |
| — | **If schema found:** use it; skip schema picker. |
| — | **If no schema:** user chooses — **download from catalog** (tiered picker; see **#18**) **or** **use local schema file…** (copy into `schema/`). |
| — | After schema is established (first setup): show **Project metadata** dialog (see below). |
| — | Failed download: **all-or-nothing rollback**. |
| — | Opening a folder that already has files is allowed. |

### Project metadata (#15 — locked)

| # | Decision |
|---|----------|
| — | Shown **after schema selection** on first project setup. |
| — | **Must Save once** on first setup — no Skip/Cancel that leaves project without `project-metadata.json` (fields inside may be blank). |
| — | **Not** shown on every project open if `schema/project-metadata.json` already exists. |
| — | Dialog fields from **`schemaMetadataFields`** (shared TEI set for `teiAll` + `teiLite` in v1). |
| — | User can **add custom fields** at the bottom (path + label + value). |
| — | **Blanks stay blank** — omitted from JSON / not injected into new files. |
| — | Stored in **`schema/project-metadata.json`**; referenced from project JSON. |
| — | Copying **`schema/`** to a new project brings metadata + RNG + CSS (validate `catalogId` / paths if schema differs). |
| — | **Settings → encoder name** pre-fills **`titleStmt/principal`** on new project setup only; stored value lives in project JSON; changing Settings later does not auto-update projects. |
| — | **Per-file:** `<title>` always **`Untitled`** on New File (not a project-default field). **`sourceDesc`** excluded from bulk apply by default (often document-specific). |
| — | **No `xmlns:rdf`** in skeleton unless schema/user requires it. |

**v1 project metadata fields** (same for `teiAll` and `teiLite`; plus custom rows):

| Label | TEI path (`teiHeader` relative) |
|-------|----------------------------------|
| Licence / rights | `publicationStmt/availability/licence` |
| Publisher / distributor | `publicationStmt/distributor` |
| Funder | `titleStmt/funder` |
| Principal (encoder) | `titleStmt/principal` |
| Encoding project description | `encodingDesc/projectDesc/p` |
| Default language | `profileDesc/langUsage/language` |

**Local schema file:** if TEI-like, use the same field set; if unknown/non-TEI, **custom rows only** + short explanatory note (no `sourceUrl`, no update checks).

### Per-file metadata panel (locked)

| # | Decision |
|---|----------|
| — | **Right-hand panel** (LEAF-Writer east rail / utilities area), not a left-sidebar tab. |
| — | **First icon** in the right-rail icon strip; **default visible panel when a file is opened**. |
| — | Right-rail uses **icons instead of text labels** to save space (file metadata icon first; validation, XML viewer, etc. follow). |
| — | Edits **current file** header fields — at minimum **`titleStmt/title`**, **`sourceDesc`** (and room to grow). Writes through to tab XML / editor. |
| — | **Edition metadata** (project defaults) remains **Project → Edition metadata…** dialog — not this panel. |
| — | Distinct from project JSON: panel shows **effective values in this file**; changing title here does not change `project-metadata.json`. |

**Minimal structural skeleton** (always present for validation, regardless of metadata blanks):

```xml
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><p/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
</teiHeader>
```

Non-blank entries from `project-metadata.json` are **merged** into this structure when creating New File XML.

**Harmonisation model:**

| Scope | Examples | Storage |
|-------|----------|---------|
| Project-wide | licence, funder, encodingDesc, principal | `project-metadata.json` |
| Per-file | title, sourceDesc (usually), revisionDesc | In each XML file |

### Edition metadata menu + propagation

| # | Decision |
|---|----------|
| — | **Project → Edition metadata…** re-opens the dialog for the current project. |
| — | **Save** writes `schema/project-metadata.json`. |
| — | If defaults **changed** and project contains XML files → confirmation dialog. |
| — | **Save defaults only** — JSON updated; existing files unchanged; new files use new defaults. |
| — | **Save and update documents…** — second step: apply **managed fields** to all project XML files (see below). |
| — | **Cancel** — revert dialog without saving. |

**Apply to existing files (v1 rules):**

- Scope: **all `*.xml` under `project rootPath` recursively** (exclude `schema/` and non-XML). App has no access outside project root in normal use.
- Update only **managed fields** listed in metadata JSON (schema field map + custom entries).
- **Exclude by default:** `titleStmt/title`, `sourceDesc` (file-specific; edited in per-file metadata panel).
- **Set/update** non-blank values in each file’s `<teiHeader>`.
- **Clearing a default** in JSON does **not** remove values from existing files unless user opts in: **“Also clear removed fields from existing documents.”**
- Skip non-TEI / invalid files; show summary (N updated, M skipped).
- Warn if open tabs are **dirty** before bulk apply.
- v2 (later): track per-file overrides vs last-applied defaults to avoid clobbering intentional edits.

### New File (⌘N)

| # | Decision |
|---|----------|
| — | No auto-document when project opens. |
| — | ⌘N without project → Open Project prompt. |
| — | Requires project schema + metadata file (metadata may be empty `{}`). |
| — | Temp file on disk; tab **`untitled.xml`**; Save As into project. |
| — | Save As initial directory: **explorer-selected folder** if a folder is selected; if a **file** is selected, its **parent folder**; else **project root**. User can navigate elsewhere in the dialog. |
| — | Closing/discarding unsaved temp tab → **prompt** (Save / Don’t save / Cancel). |
| — | Skeleton = minimal header + merged **non-blank** project metadata + `text/body/div/p`. **One shared body template** for **`teiAll`** and **`teiLite`** (validate against both). |
| — | Caret in first `<p>`. Relative `xml-model` / `xml-stylesheet` PIs. |

### Switching projects with unsaved work

| # | Decision |
|---|----------|
| — | One dialog: unsaved documents list (Save all / Don’t save / Cancel). |

### Schema updates (phase 3)

| # | Decision |
|---|----------|
| — | Throttled check on project open when online; silent if unchanged. |
| — | Bundled RNG + CSS update with `schema/_archive/` backup. |
| — | After schema upgrade: validate `project-metadata.json` field paths still legal. |

### Schema catalog (#18 — locked)

| # | Decision |
|---|----------|
| — | **Single source of truth:** `packages/cwrc-leafwriter/src/config/schemas.ts`, exposed as editor `schemasList` (same list as `SelectSchemaDialog` / `NativeSchemaPickerPage`). Do not maintain a separate project-only catalog. |
| — | **`apps/commons/src/config/schemas.ts`** (CWRC Event, CWRC Lite, REED, etc.) remains **localhost dev only** for now; optional desktop merge later. |
| — | **v1 enabled for full project flow** (download + metadata field map + New File skeleton): **`teiAll`**, **`teiLite`**. |
| — | **Tiered picker UI:** show TEI All + TEI Lite prominently; **More schemas…** lists `teiSimplePrint`, `jTei`, `orlando` (disabled or “coming soon” until skeleton + `schemaMetadataFields` exist for each). |
| — | **Use local schema file…** always available — copy into `schema/` **keeping original filenames** (`.rng`, `.css`, etc.); no `sourceUrl`; metadata field set per TEI vs custom rules above. |
| — | Reuse **`NativeSchemaPickerPage`** / **`SelectSchemaDialog`** patterns where possible; pass `enabledCatalogIds` or filter for project setup. |
| — | **Phased delivery:** add `teiSimplePrint`, `jTei`, then `orlando` (separate non-TEI header field map) as templates and metadata maps are implemented. |

Current built-in catalog entries:

| id | name | mapping | v1 project flow |
|----|------|---------|-----------------|
| `teiAll` | TEI All | tei | **Enabled** |
| `teiLite` | TEI Lite | teiLite | **Enabled** |
| `teiSimplePrint` | TEI Simple Print | tei | More… (Phase 4) |
| `jTei` | jTEI Article | tei | More… (Phase 4) |
| `orlando` | Orlando | orlando | More… (phase 3; non-TEI skeleton) |

### Technical

| # | Decision |
|---|----------|
| — | RelaxNG only (Salve). |
| — | Monolithic `.rng` for TEI P5 4.x downloads. |

---

## User flows

### Flow A — Open Project + schema + metadata setup

1. **File → Open Project…** (⌘O)
2. User selects or creates a folder
3. Load or create `jean-baptiste.project.json`
4. **Schema present?** → register schemas; if `project-metadata.json` missing, go to step 6; else done
5. **No schema?** → tiered catalog download or local file copy into `schema/`; rollback on failure
6. **Project metadata dialog** — required Save (may leave fields blank); encoder name → `titleStmt/principal` from Settings
7. Write `schema/project-metadata.json`; do **not** create a document

**Import:** copying `schema/` from another project skips steps 5–6 if files present; user may open **Edition metadata…** to edit.

### Flow B — New File

1. **File → New File** (⌘N)
2. Build XML: minimal header + merge non-blank metadata + body skeleton
3. Temp path; open as `untitled.xml`; caret in first `<p>`
4. Save As → user path; default folder per explorer selection rules above

### Flow C — Open file → per-file metadata panel

1. User opens an XML file from explorer (or New File after Save As)
2. Editor loads; **right rail opens to file metadata panel** (first icon, default)
3. User edits title, sourceDesc, etc.; changes sync to document XML

### Flow D — Edition metadata (edit later)

1. **Project → Edition metadata…**
2. Edit fields; Save
3. If JSON changed:
   - **Save defaults only**, or
   - **Save and update documents…** → confirm → apply managed fields to all XML in project tree

### Flow E — Schema update check

1. On project open (throttled, online) → hash compare
2. If changed → dialog; optional bundled update + re-validate metadata paths

---

## Implementation phases

### Phase 1 — Open Project + schema + metadata

**Shipped and smoke-tested (June 2026).** See `docs/smoke_test.md`.

- Schema wizard (tiered catalog from `schemasList`; local file copy); rollback on failure
- `schemaCatalog.ts` or shared filter — `enabledCatalogIds`: `teiAll`, `teiLite` for v1
- `schema/project-metadata.json` read/write
- Schema-driven metadata dialog + custom rows
- Settings: **encoder name** (localStorage / Electron prefs)
- `schemaMetadataFields.ts` — field lists for **`teiAll`** and **`teiLite`** first
- **Project → Edition metadata…** menu item
- Save + optional **apply to existing files** with confirmation rules above
- Unsaved-documents dialog when switching projects

### Phase 2 — New File + temp + Save As

**Shipped (June 2026).** Automated tests in `apps/commons/src/desktop/newFileSkeleton.test.ts` and `newFileSkeleton.validation.test.ts` (RelaxNG cases require network). Manual checklist: `docs/smoke_test.md` section I.

- ⌘N; skeleton merge from metadata + minimal header
- `schemaTemplates.ts` — **one shared TEI body** for **`teiAll`** and **`teiLite`**
- Save As default directory from explorer focus; temp tab close prompt (Save / Don't save / Cancel) + temp cleanup
- Validator tests: skeleton validates against **both** v1 schemas (live TEI RNG URLs)

### Phase 3 — Per-file metadata panel + right-rail icons

**Shipped (June 2026).** Automated tests in `apps/commons/src/desktop/fileMetadata.test.ts`. Manual checklist: `docs/smoke_test.md` section J.

- Right-rail **icon strip** (text labels → icons where needed)
- **File metadata panel** — first icon; **default on file open**
- Bind panel fields to current file `<teiHeader>` (title, sourceDesc, …)
- Sync edits to WYSIWYG / tab content

### Phase 4 — Expand catalog (after core ships)

- Enable `teiSimplePrint`, `jTei` in picker + skeletons + metadata field maps
- Enable `orlando` (non-TEI skeleton + field map)
- Optional: merge `apps/commons` dev schemas into desktop catalog

### Phase 5 — Schema update alerts

- Throttled check; bundled RNG+CSS update; metadata path validation after upgrade

### Phase 6 — Polish

- Override tracking before bulk apply (v2)
- Manual “Check for schema updates” menu item
- Per-file `revisionDesc` / last-edited timestamp (`docs/todo.md`)

---

## Key files (planned)

| File | Role |
|------|------|
| `apps/desktop/src/main.ts` | Menus: Open Project, New File ⌘N, Edition metadata |
| `apps/desktop/src/projectFile.ts` | Schema setup, types, metadata path |
| `apps/commons/src/overmind/project/actions.ts` | openProject, metadata save, applyToFiles, newFile |
| `apps/commons/src/desktop/useProjectMenu.ts` | Menu + keyboard bridge |
| `apps/commons/src/desktop/schemaSetup.ts` (new) | Download, copy, hash, rollback |
| `apps/commons/src/desktop/projectMetadata.ts` (new) | JSON I/O, merge into teiHeader, apply to files |
| `apps/commons/src/desktop/schemaMetadataFields.ts` (new) | Per-catalog dialog field definitions |
| `apps/commons/src/desktop/schemaTemplates.ts` (new) | Body + minimal header shell |
| `apps/commons/src/desktop/checkSchemaUpdate.ts` (new) | Throttled update check |
| `apps/commons/src/pages/project/NativeSettingsPage.tsx` | Encoder name setting |
| `packages/cwrc-leafwriter/src/config/schemas.ts` | Catalog source of truth (URLs) |
| `apps/commons/src/desktop/schemaCatalog.ts` (new) | v1 `enabledCatalogIds`, tiered picker helpers |
| `SelectSchemaDialog` / `NativeSchemaPickerPage` | Reuse for project schema pick |
| `packages/cwrc-leafwriter/src/layout/Utilities.tsx` (or desktop override) | Right-rail icons; default panel on open |
| `apps/commons/src/desktop/FileMetadataPanel.tsx` (new) | Per-file header fields bound to active tab |

---

## Out of scope

- Pre-bundling full TEI RelaxNG directory in the app
- TEI Publisher / preview pane / XSLT export
- TEI ODD GUI; Git integration
- Auto-create document on project open
- Per-file override tracking in v1 bulk apply

---

## Testing plan

| Case | Expect |
|------|--------|
| First open, no schema | Schema wizard → metadata dialog → JSON written |
| Catalog picker v1 | TEI All + Lite enabled; More… shows other entries |
| Download teiAll / teiLite | Files in `schema/`; provenance in project JSON |
| Re-open project | No metadata dialog if JSON exists |
| Blank metadata fields | Omitted from JSON; new files get minimal header only |
| Settings encoder name | Pre-filled in metadata dialog on new setup |
| Copy `schema/` to new project | Metadata + RNG available |
| Edition metadata → Save only | JSON updated; XML unchanged |
| Edition metadata → Apply all | Managed fields updated; title/sourceDesc skipped |
| Clear default + apply without “clear from files” | Old XML values kept |
| ⌘N | Merged header validates; Untitled title |
| Close unsaved temp tab | Prompt Save / Don’t save / Cancel |
| First metadata dialog | Cannot dismiss without Save |
| Open file | File metadata panel visible by default (right rail) |
| Apply metadata to files | All `*.xml` under root; title/sourceDesc skipped |
| Metadata apply with dirty tabs | Warning / prompt |
| Local schema copy | Original `.rng` / `.css` filenames preserved |
| Schema update | Metadata paths re-validated |

---

## References

- [TEI P5 RelaxNG — tei_all.rng](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng)
- [LEAF-Writer validator README](../packages/cwrc-leafwriter-validator/README.md)
- FairCopy header template: `faircopy/src/render/model/tei-template.js`
- Valid minimal header example: `packages/cwrc-leafwriter-validator/test/mocks/cwtcTeiLite/documentValid.ts`
