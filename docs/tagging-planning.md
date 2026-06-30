# Tagging infrastructure — implementation plan

**Status:** Phase 1 implemented (Enter-tag popup, F2 rename, insert/split, propagate, queue-walk, tag stats). Phase 2 implemented (Alt+Enter attribute popup, attributes panel, Lookup, tag colours, attr stats).  
**Scope:** Desktop app — fast structural/semantic tagging, attributes, later disambiguation and bulk ID propagation  
**Related:** `docs/todo.md`, `docs/project-schema-planning.md`, `docs/schema_handling.md`

---

## Summary

LEAF-Writer today conflates **identifying** a string (`persName`), **linking** it to an authority (`@ref`), and **managing entities** (dialogs, RDF) in one slow path. LJB replaces that with a **phased workflow** inspired by Markus and especially **Norbert**:

1. **Automated markup** — regex, lists, DB scripts, XPath cleanup — **outside LJB** (Python), for the foreseeable future.
2. **Identify** — wrap text in schema-valid tags **without attributes**; fast, keyboard-driven.
3. **Disambiguate** — batch negative filtering against project databases (wrong 1:1 match, pick among homonyms, mark new entities).
4. **Propagate attributes** — table-driven bulk update of `@ref`, `person_id`, etc., then push new records to the database.

This document plans **tagging infrastructure** for LJB. **v1 core** is Oxygen-style keyboard editing:

- **Enter** — tag chooser popup (wrap selection, insert at caret, or apply/propagate/queue-walk **inside popup only**); never renames tags.
- **F2** — rename tag in editor; rename file/folder in explorer (same chord, focus-dependent).
- **Alt+Enter** — attribute chooser popup (name → value, autofill from stats); authority lookup **not** in popups.
- **Right attributes panel** — slow path: all attrs on current tag, editable element name, **Lookup…** button, **discrete colour control** for all tags of that element type (highlight + text → project CSS).
- **Per-type tag colours** — small panel control updates `schema/tag-colors.json` + generated CSS; applies project-wide immediately when tags are shown.

Later phases: disambiguation queue, resolution-file attribute propagation, linked vs bare visual states (can reuse colour system).

---

## Why the current LEAF-Writer model is wrong for LJB

| Norbert / Markus phase | Goal | LEAF-Writer today |
|------------------------|------|-------------------|
| 1. Auto markup | External scripts | Partial “Scrape Candidate Entities” only |
| 2. Identify | `persName` without IDs | Toolbar → `PersonDialog` → authority lookup |
| 3. Disambiguate | Table, negative filter | Per-tag lookup modal |
| 4. Propagate IDs | Bulk from resolutions | One entity at a time |

Relevant code today:

| Piece | Role | Path |
|-------|------|------|
| Entity dialog chain | Select → modal → lookup | `tagger.addEntityDialog`, `PersonDialog`, `useEntityLookup` |
| Structure wrap / rename | Wrap, edit tag name | `tagger.addStructureTag`, `tagger.editStructureTag`, `changeTagDialog` |
| Split at caret | Context menu only; skips entities | `tagger.splitTag` |
| Schema child check | Valid parent/child | `schemaManager.isTagValidChildOfParent` |
| Possible tags at cursor | Validator suggestions (valid + invalid flags) | `@cwrc/leafwriter-validator` → `getPossibleNodesAt` |
| Attributes modal | Slow jQuery dialog | `attributesEditor/attributesEditor.ts`, `AttributeWidget` |
| TEI entity attrs | `@ref`, `@key`, `@cert` | `schema/mappings/tei.ts` |
| Enter = new paragraph | TinyMCE default | `tinymceWrapper.ts` (keydown/keyup) |
| Explorer rename | IPC | `renameExplorerItem`, `renamePath` |

**North star:** *Enter names or inserts tags; F2 renames tags; Alt+Enter adds attributes; propagate and queue-walk live only in the tag popup; authority lives in the attributes panel; linking and bulk ID work stay separate, never blocking identify.*

---

## Locked decisions — keyboard model

All default chords are **customisable** in Settings (Tagging section) to avoid OS conflicts (Spotlight, input-source switching, etc.).

### Master chord table (defaults)

| Context | Enter | Alt+Enter | Shift+Enter | F2 |
|---------|--------|-----------|-------------|-----|
| **Editor — text selected** | Tag popup → **wrap** selection (nest if schema allows) | Attribute popup | **Line break** (split if inside inline tag) | Rename **innermost tag at caret** |
| **Editor — collapsed caret** | Tag popup → **insert** (`p` default in list) | Attribute popup on **current tag** | **Line break** (split if inside inline tag) | Rename **tag at caret** |
| **Tag popup open** | Apply **single** | **Queue-walk** | **Propagate** all exact matches in file | — |
| **Attribute popup open** | Commit attribute; stay open for next attr | — | Propagate attr (later phase) | — |
| **Explorer — item selected** | — | — | — | Rename **file/folder** |

**Enter never renames a tag.** **Text selected + Enter always wraps/nests**, never opens rename mode.

**Tag popup propagate / queue-walk chords apply only while that popup is open** — not globally.

**Never open any popup during IME composition** (`event.isComposing`).

---

## Block: Enter-tag popup

### Editor paradigm (Oxygen-style)

- **Enter never inserts a line break** in the WYSIWYG editor.
- **With text selected:** Enter opens IME-style popup → user filters tags (↑↓) → **Enter** in popup wraps selection. Valid **nesting** inside parent tag (e.g. `note` inside `persName`) when schema allows; same element nested (e.g. `persName` in `persName`) blocked in popup and in propagate.
- **With collapsed caret:** Enter opens the **same popup in insert mode**. **`p` is the default highlighted suggestion** — user must confirm or pick another (`persName`, `pb`, …). **No silent insert** without the popup.
- **Esc** closes popup without applying.

### Three apply modes (tag popup only)

| Mode | Action | Chord (in popup) |
|------|--------|------------------|
| **Single** | Wrap selection or insert one element at caret | **Enter** |
| **All in file** | Same tag on every **exact** match of selected string in open file | **Shift+Enter** |
| **Queue-walk** | Apply tag → jump to next **untagged** occurrence of same string; repeat | **Alt+Enter** |

- Popup shows **buttons** for all three modes plus match count (“14 matches in this file”).
- **Single undo step** per apply (including bulk and queue segments).

### Propagate rules

- **Identical = identical** — no case folding, no whitespace normalization (optional advanced setting later).
- Scope: **open file only** (v1).
- Skip matches already inside a tag of the **same element name**.
- Allow valid nesting in different element types per schema.
- Report skipped count after bulk apply.

### Popup UX

- Native / Electron overlay at cursor (movable); **instant** (no modal, no network on open).
- Filter as user types; **arrow keys** to highlight (no Tab-to-complete).
- **Last used tag** pre-selected when popup opens (wrap mode); **`p` pre-selected** in insert mode.
- Suggestion order: usage statistics (file + project), then alphabetical; invalid tags greyed or hidden (setting).
- **No authority lookup or attribute fields on this popup.**

### Queue-walk loop

1. Select string → Enter → popup with last tag highlighted.  
2. **Alt+Enter** in popup → wrap → auto-select next untagged occurrence.  
3. Repeat (minimal UI; popup may collapse to one-line hint).  
4. **Esc** → exit walk.

---

## Block: F2 rename tag

- **F2** in the **visual editor** renames the **innermost tag containing the caret** (not the selected text string).
- Opens the **same tag suggestion popup** as Enter, pre-filled with current `_tag`; **Enter** commits rename via `editStructureTag` / `changeTagDialog` logic.
- **Keep attributes** valid on the new element; drop invalid ones with brief feedback.
- Changing entity-like tags (`persName` → `placeName`): warn if link attrs (`@ref`, …) will be removed — confirm once.
- **F2** in the **source editor (Monaco)** navigates to and selects the tag name in the opening tag of the element at the cursor, enabling inline rename. Monaco's `linkedEditing` mode then renames the closing tag simultaneously as the user types. Works whether the cursor is in element content, inside an opening tag, or inside a closing tag (in the last case, it finds and navigates to the matching opening tag).
- **F2** in the **explorer** renames file/folder (existing `renameExplorerItem` / `renamePath`) — same chord, focus-dependent (standard IDE pattern).
- **Attributes panel** shows current element name with “F2 to rename” hint.
- **Backspacing away** a tag (unwrap when empty) remains supported — do not trap the user in `prevent_delete` logic.

---

## Block: Insert at caret and split (Oxygen-style)

When user confirms insert from the tag popup (collapsed caret):

| Intended insert | Parent context | Behaviour |
|-----------------|----------------|-----------|
| Same tag as parent (e.g. `p` inside `p`) | Block | **Split parent** at caret into two sibling tags |
| Inline tag valid `inside` current element | e.g. `label` inside `p` | Insert `<tag/>` at caret via `editor.insertContent` — never wraps parent content |
| Block tag valid `after` current element | e.g. `desc` after `p` | Insert empty sibling after current element |
| `p` anywhere inside a `p` ancestor | — | Split the `p` at caret (fast path, no popup confirmation needed) |
| Invalid | any | Greyed in popup or refuse with one-line message |

**Key rule:** with no selection, insertion *never wraps existing content*. The validator's `resolveInsertAction` resolves to `inside`, `after`, or `add`; the first two route to insert-at-caret or insert-as-sibling; `add` also routes to insert-at-caret (inline empty tag). The pre-existing `cleanRange` path in `isSelectionValid` is bypassed for no-selection inserts to prevent it from silently expanding the range in the wrong direction.

**Shift+Enter** outside popups (line break) uses the **same split/insert engine** as choosing `lb` from the popup — one code path.

### Wrapping with a cross-boundary selection

When the user selects text that spans element boundaries (e.g. from inside `<persName>` through trailing plain text), the normal `isSelectionValid` check fails. Instead of erroring:

1. Save the original range **before** calling `isSelectionValid` (which runs `cleanRange` and distorts the range).
2. On failure, restore the original range and call `expandSelectionToElementBoundaries`: walk up from both ends of the range to the LCA, then extend to cover complete child elements of the LCA.
3. Re-validate the expanded range. If it passes, wrap it.

Result: selecting `<persName>Jeff</persName> is a cute` and wrapping with `<label>` yields `<label><persName>Jeff</persName> is a cute</label>` rather than an error.

Implementation notes:

- `resolveInsertAction` in `tagCommand.ts` — three-step: `inside` → `after` → `add` (wrap).
- `insertEmptyTagAtCaret` uses `editor.insertContent` with a `﻿` placeholder and `utilities.selectElementById` to place cursor inside the new tag.
- `applyWrapTag` in `tagCommand.ts` handles `expandSelectionToElementBoundaries` before `addStructureTag`.
- Extend or replace `tagger.splitTag` (today skips `_entity` tags; LJB bare tags should not use full entity wrapper).
- Use validator **`getPossibleNodesAt`** with actions `addInside`, `addAfter`, speculative validate, to choose split vs nest vs reject.
- Reference: Oxygen Author — paragraph break inside inline splits the inline element.

---

## Block: Alt+Enter attribute popup

- **Alt+Enter** in editor (not in tag popup) opens instant overlay at caret.
- **Field 1 — attribute name:** autocomplete from schema for current tag + **file/project attr stats** (most-used first).
- **Tab** → **Field 2 — value:** autocomplete from values already used for that `(element, attr)` in this file (and optionally project).
- **Enter** → commit attribute on **current tag only**; popup **stays open** for the next attribute (Oxygen-style chaining).
- **Esc** → close.
- **No Lookup button** on this popup.

Entity tags (`persName`, …): route to lightweight attr editing, **not** full `PersonDialog` / RDF path.

---

## Block: Attributes panel (right rail)

- Icon in east-rail strip (alongside file metadata panel from `project-schema-planning.md`).
- Reflects **tag under caret** (live sync with editor selection).
- **Element name** row (read-only label + F2 hint, or dropdown for slow rename).
- Full attribute list: add / edit / remove; schema help for enumerated values.
- **Lookup…** button — Wikidata / project DB (reuse stripped-down authority UI); fills link attrs (`@ref`, `@key`, … per `tei.ts` mapping).
- **Attribute propagation** (later): separate panel action or Shift+Enter in attr popup — apply attr+value to all matching tags in file (same element + same text; optionally skip already-linked).

Reuse logic from `AttributeWidget` / `getAttributesForTag`; **new native React UI**, not the 650px jQuery modal.

### Per-type tag colours (panel header)

When the caret is in a tagged element (e.g. `persName`), show a **very small, discrete control** in the panel header (e.g. twin swatches or a single palette icon — not a large colour-picker block):

- Sets colours for **all tags of that element type in the project** — not just the current instance.
- Two values per type:
  - **Highlight** — background / highlight colour (tag surround when tags visible).
  - **Text** — foreground colour of tagged content.
- On change:
  1. Update **`schema/tag-colors.json`** (source of truth, portable with `schema/`).
  2. Regenerate **`schema/tag-colors.css`** (or append rules to project stylesheet bundle).
  3. **Inject / reload** CSS in the WYSIWYG iframe immediately — all open files and future opens see the update without editing XML.

**Default colours:** ship schema/catalog defaults (can mirror LEAF-Writer entity palette in `editor.less` for common TEI names); user overrides stored only in project JSON/CSS.

**Selectors:** target WYSIWYG nodes by `_tag`, e.g. `.showTags *[_tag='persName']` for highlight + text (match existing `*[_tag='pb']` pattern in `packages/cwrc-leafwriter/src/css/editor.less`). Respect **Show tags** toggle; optional subtle styling when tags hidden (later).

**Scope:** per **element name** (`persName`, `placeName`, `date`, …), not per attribute value or entity ID. Renaming element type (F2) does not auto-migrate colour entry — old name’s rule remains until user clears (edge case; document in UI).

**Reset:** context menu or long-press on swatch → “Reset to default for this tag type.”

Reference: FairCopy colour coding — `faircopy/src/render/components/project-settings-window/ColorCodingDialog.jsx`.

---

## Block: Tag colour storage and CSS generation

### Project files

```
schema/
  tei_all.rng
  tei.css                    # schema/catalog stylesheet (unchanged role)
  tag-colors.json            # user overrides per element type
  tag-colors.css             # generated; do not hand-edit
```

Referenced from `jean-baptiste.project.json` (e.g. `schema.tagColors` path) alongside existing `schema.css`.

### JSON shape

```typescript
export interface TagColorsFile {
  version: 1;
  /** element name → colours. Omitted types use catalog defaults. */
  tags: Record<
    string,
    {
      /** CSS colour for highlight / background */
      highlight?: string;
      /** CSS colour for text */
      text?: string;
    }
  >;
}
```

### Generated CSS (example)

```css
/* schema/tag-colors.css — generated from tag-colors.json */
.showTags *[_tag='persName'] {
  background-color: #e8f4fc;
  color: #1a5276;
}
.showTags *[_tag='placeName'] {
  background-color: #eafaf1;
  color: #186a3b;
}
```

- Use **CSS custom properties** optionally (`--ljb-tag-persName-highlight`) for easier dark-mode overrides later.
- **`tagColors.ts`**: read/write JSON, emit CSS, hot-reload editor stylesheet on save.
- Colours apply to **WYSIWYG only** in v1; source editor syntax theme unchanged unless user opts in later.

---

## Block: Statistics

```typescript
/** schema/tag-stats.json or project JSON extension */
export interface TagUsageStats {
  version: 1;
  /** element name → count across project */
  project: {
    tags: Record<string, number>;
    /** element → attr → count */
    attrs: Record<string, Record<string, number>>;
    /** element → attr → value → count */
    attrValues: Record<string, Record<string, Record<string, number>>>;
  };
  /** relative file path → same shape as project subset */
  files: Record<string, {
    tags: Record<string, number>;
    attrs: Record<string, Record<string, number>>;
    attrValues: Record<string, Record<string, Record<string, number>>>;
  }>;
}
```

Updated on save or debounced after tag/attr apply. Used for popup ordering only, not validation.

---

## Settings (Tagging section in Native Settings)

| Setting | Default |
|---------|---------|
| Chords: tag popup / attrs / rename / line break | See master table (all remappable) |
| Default insert suggestion (insert mode) | `p` highlighted, not silent |
| Line-break element | `lb` (schema-dependent) |
| Show invalid tags in popups | greyed (true) / hidden (false) |
| Propagate: exact match only | on |
| Attr propagate: skip already-linked | on (later) |

Schema validity remains authoritative; settings tune **behaviour**, not RelaxNG rules.

---

## Later blocks (not v1 core)

### Disambiguation queue

- Panel or exportable table: unique `(surface string, tag name)` where link attrs empty.
- Negative filtering (Norbert phase 3); CSV/JSON in project folder + Python OK for v1 of this block.
- Optional in-app Wikidata / project SQLite — not CWRC cloud auth by default.

### Attribute propagation (resolution file)

- Separate from tag popup: “Apply resolution to matching tags.”
- Input: resolution file or queue state (`surface`, `tag`, `ref` / `person_id`).
- Project-wide propagate opt-in later.
- Export new entities → external DB → re-import IDs (Norbert phase 4).

### Visual tag states (later)

- Optional badges/overlays for **linked** vs **bare** vs **pending new entity** — can layer on top of per-type colours from `tag-colors.json`.

### Automated markup

- Stays **external Python** for foreseeable future.

---

## What already exists (reuse)

| Capability | Status | Where |
|------------|--------|-------|
| Wrap selection in tag | Done | `tagger.addStructureTag` |
| Rename tag | Done (modal path) | `changeTagDialog`, `editStructureTag` |
| Split at caret | Partial | `tagger.splitTag` |
| Possible nodes at target | Done | `getPossibleNodesAt` |
| Attributes editor | Done (replace UX) | `attributesEditor`, `AttributeWidget` |
| Explorer rename | Done | `renameExplorerItem`, `renamePath` |
| Enter = paragraph | **Replace** | `tinymceWrapper.ts` |
| Enter / F2 / Alt+Enter popups | **Phase 1 done** (Enter + F2); Alt+Enter Phase 2 | `apps/commons/src/desktop/tagging/` |
| Attributes panel | **Not done** | — |
| Per-type tag colours (project CSS) | **Not done** | defaults in `editor.less` (entity types only) |
| Tag + attr stats | **Not done** | — |
| Disambiguation queue | **Not done** | — |

---

## Implementation phases

### Phase 1 — Enter-tag popup + F2 rename + split/insert

- Intercept **Enter** / **F2** on keydown; respect IME composition.
- **`TagCommandPopup`**: wrap, insert, rename modes; propagate + queue-walk chords in popup only.
- **`tagInsert.ts`** (new): insert at caret, Oxygen split for block/break in inline parents.
- **`tagPropagate.ts`**: exact-match scan, skip rules, single undo.
- **`tagStats.ts`**: tag counts only (attrs in Phase 2).
- Replace TinyMCE Enter = paragraph; **Shift+Enter** → line break via split engine.

**Deliverable:** Fast identify + insert + rename without entity dialogs.

### Phase 2 — Alt+Enter attribute popup + attributes panel + tag colours

- **`AttributeCommandPopup`**: name → Tab → value, stats autofill, chain attrs with Enter.
- **`AttributesPanel.tsx`**: right rail; element row, full attr list, **Lookup…**, **discrete colour swatch** (highlight + text).
- **`tagColors.ts`**: `tag-colors.json` + generated `tag-colors.css`; load with project schema CSS; hot-reload on change.
- Extend **`tagStats.ts`** for attr/value counts.
- Deprecate modal `AttributesEditor` for desktop path.

### Phase 3 — Queue-walk polish + reporting

- Sticky queue-walk; toast “Applied 12, skipped 3 (already tagged).”
- Attr popup Shift+Enter propagate in file (optional).

### Phase 4 — Disambiguation queue

- Mention extraction panel; CSV/JSON export/import; in-app negative filtering.

### Phase 5 — Resolution-file attribute propagation

- Bulk apply from resolutions; new-entity export for external DB.

### Phase 6 — Polish

- Customisable chords UI with conflict warnings.
- Source editor parity (optional).
- Project-wide propagate opt-in; AI assist (`docs/todo.md` — exploratory).

---

## Key files (planned)

| File | Role |
|------|------|
| `apps/commons/src/desktop/tagging/tagCommandPopup.tsx` (new) | Tag IME overlay |
| `apps/commons/src/desktop/tagging/tagCommand.ts` (new) | Wrap / insert / rename modes |
| `apps/commons/src/desktop/tagging/tagInsert.ts` (new) | Insert + Oxygen split |
| `apps/commons/src/desktop/tagging/tagPropagate.ts` (new) | Exact-match propagate |
| `apps/commons/src/desktop/tagging/attributeCommandPopup.tsx` (new) | Alt+Enter attr overlay |
| `apps/commons/src/desktop/tagging/AttributesPanel.tsx` (new) | Right rail + Lookup + colour swatch |
| `apps/commons/src/desktop/tagging/tagColors.ts` (new) | JSON + CSS generate + editor inject |
| `schema/tag-colors.json` | Per-type highlight + text overrides |
| `schema/tag-colors.css` | Generated stylesheet (git-tracked or regenerated on open) |
| `apps/commons/src/desktop/tagging/tagStats.ts` (new) | Tag + attr usage counts |
| `apps/commons/src/desktop/tagging/tagSuggestions.ts` (new) | Validator + stats merge |
| `apps/commons/src/desktop/tagging/keybindings.ts` (new) | Defaults + Settings persistence |
| `packages/cwrc-leafwriter/src/js/tinymce/tinymceWrapper.ts` | Enter/F2/Alt+Enter interception |
| `packages/cwrc-leafwriter/src/js/tagger.ts` | splitTag, addStructureTag, editStructureTag |
| `apps/commons/src/pages/project/NativeSettingsPage.tsx` | Tagging + chord settings |
| `apps/commons/src/desktop/tagging/disambiguationQueue.ts` (Phase 4) | Mention extraction |
| `apps/commons/src/desktop/tagging/attributePropagate.ts` (Phase 5) | Bulk attr apply |

---

## Out of scope (v1 core)

- In-app automated markup (Python external)
- CWRC cloud / LINCS as default
- Full Entity + RDF for every bare `persName`
- Authority lookup in popups
- Disambiguation table UI (Phase 4)
- Project-wide tag/attr propagate on first ship
- AI tagging API

---

## Testing plan

| Case | Expect |
|------|--------|
| Select text + Enter | Tag popup; last tag highlighted; Enter wraps (nests if valid) |
| Select text inside `persName` + Enter | Nested tag only; never rename |
| Collapsed Enter | Insert popup; `p` highlighted; must confirm |
| Type `persName` + Enter (insert) | Empty `persName` at caret if valid |
| F2 on tag | Rename popup with current name; Enter renames |
| F2 in explorer | Rename file/folder |
| Shift+Enter outside popup | Line break; splits inline parent if needed |
| Insert `lb` / `p` inside `persName` | Parent splits into two; break between |
| Tag popup Shift+Enter | All exact matches wrapped; one undo |
| Tag popup Alt+Enter | Queue-walk through untagged matches |
| Alt+Enter in editor | Attr popup; Tab to value; chain with Enter |
| Lookup in attr popup | Not present |
| Lookup in attributes panel | Fills link attrs |
| Colour swatch in panel | Opens compact picker; highlight + text |
| Change `persName` colours | All `persName` in project update visually |
| Save / switch file | Colours unchanged (project CSS) |
| Reset colour for type | Reverts to catalog default; JSON entry removed |
| Backspace out of empty tag | Unwrap allowed |
| Nested `persName` via propagate | Skipped |
| Nested `note` in `persName` via wrap | Allowed if schema OK |
| Invalid tag in popup | Greyed or blocked |
| IME composing + Enter | No popup |
| Save file | Stats updated |
| Remapped chord in Settings | New binding works; conflict shown |

---

## References

- Norbert / Markus workflow (phases 2–4 inform later blocks)
- Oxygen XML Editor — Enter tag chooser, Alt+Enter attributes, inline split on break
- LEAF-Writer validator: `packages/cwrc-leafwriter-validator/README.md` (`getPossibleNodesAt`)
- TEI entity mapping: `packages/cwrc-leafwriter/src/js/schema/mappings/tei.ts`
- Split primitive: `packages/cwrc-leafwriter/src/js/tagger.ts` (`splitTag`)
- Explorer rename: `apps/commons/src/desktop/sidebar/useExplorerContextMenu.ts`
- Default entity/tag styling: `packages/cwrc-leafwriter/src/css/editor.less`
- FairCopy colour coding: `faircopy/.../ColorCodingDialog.jsx`
