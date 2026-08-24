# Fast keystroke-driven data entry for entity cards

**Status (2026-08-05):** Draft for discussion. Companion to [entity-database-viewer-planning.md](entity-database-viewer-planning.md) (which covers the shipped card viewer/editor this doc proposes to extend, not replace).

## 1. Why this doc exists

The entity database viewer shipped (V0–V4 in the companion doc): cards render, backlinks work, inline edit exists in both the editor sidebar and the database window. But "inline edit" there means _document-editing_ interaction — click a field, a text box appears, blur or Enter/Escape to commit, repeat per field. That's fine for touching one or two fields on one entity. It is not fast for the actual recurring job: correcting the same field across many entities in one sitting (e.g. fixing romanization on 40 rows after a segmenter bug), which wants to feel like editing a CSV in a spreadsheet app — type, Enter, next row, no mouse.

This doc is about closing that gap, not about redesigning the cards that already work.

## 2. Where things stand today

Two existing card implementations, both document-editing paradigm:

- **Editor sidebar** (`apps/commons/src/desktop/sidebar/SidebarDatabaseTab.tsx`): edit happens in a modal `Dialog`. Canonical/romanized name use click-to-reveal-a-`TextField`, committing on blur/Enter/Escape (`event.stopPropagation()` so Escape doesn't also close the dialog). Everything else is ordinary dialog form fields. No cross-field keyboard navigation — only two `onKeyDown` handlers exist in the whole 4,700-line file.
- **Database viewer** (`apps/commons/src/desktop/databaseWindow/DatabaseWindow.tsx` + `EntityCompareCard.tsx`): read-only `label: value` blocks and accordions. There's no typing surface at all here today outside the merge/hygiene accept-skip-merge workflow.

Both read/write the same flat shape, `EntitySummary` (`packages/cwrc-leafwriter/src/autoTagging/entityOps.ts:80`) — person-only fields (`familyName`, `givenName`, `nobleTitles`, `roles`) are simply `null`/`[]` for place/org/work/office entities. There is no per-kind schema to reconcile; one row shape, columns just go unused for some kinds. That's convenient: it's already the shape a grid wants.

No grid-editing primitive exists anywhere in the codebase — no DataGrid, ag-grid, handsontable, or TanStack Table. The only "grid" tech present is `react-window`'s virtualized list, used for scroll performance in both card views, not for editing.

## 3. Two different jobs, not one

Worth naming explicitly, because conflating them is probably why neither current card feels fast:

| Job                                                                                                    | Shape it wants          | Current home                                                                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| Fix several fields on **one** entity (disambiguation cleanup, filling in a date, linking an authority) | Vertical form/card      | Both cards, sort of — just slow because of click-to-reveal + no keyboard flow |
| Fix **one** field across many entities (bulk romanization fix, bulk nationality correction)            | Columnar grid, CSV-like | Nothing today — this is the real gap                                          |

The second job is the one motivating "wicked fast, all keystrokes, CSV-on-a-fast-machine." It's a genuinely different interaction, not a faster version of the card.

## 4. What "CSV-fast" requires, concretely

- **Type-to-edit on focus** — no click-to-reveal step before a keystroke lands.
- **Arrow keys move focus** cell-to-cell, not just Tab through DOM order.
- **Enter commits and moves down** a column; **Tab commits and moves right** — no modal, no explicit save button, no dialog to close.
- **Escape cancels** the in-progress edit and restores the prior value without losing grid focus.
- **Multi-cell paste** from an actual spreadsheet (tab/newline-delimited clipboard content) lands across the right cells.
- **Virtualization stays compatible with keyboard focus** — `react-window` only renders visible rows, so moving focus past the viewport needs a programmatic scroll-into-view, or the "row" the user just arrowed onto doesn't exist in the DOM yet. This is the fiddliest part and needs its own small design pass.
- **Commit strategy**: per-cell commit on blur/Enter/Tab, not a batch "save" step — matches the no-friction feel and avoids a stale-draft state.

## 5. Proposed direction

Don't try to make one card widget serve both jobs. Concretely:

1. **Leave the editor sidebar dialog alone.** It's a different context — mid-tagging, one entity, low field count — where the dialog-form pattern isn't really the bottleneck.
2. **Add a genuine editable-grid mode to the database viewer**, alongside (not replacing) the existing list + `EntityCompareCard`. Rows = entities (reusing `EntitySummary` directly, no new schema), columns = the fields worth bulk-editing (name, romanization, dates, nationality, authority ids — probably not the freeform notes, which stay prose-shaped). A toggle between "card" and "grid" view in `DatabaseWindow.tsx`, sharing the same selection/filter state that already exists there.
3. **Build a small custom keyboard-navigation layer** rather than pulling in a dependency (ag-grid/handsontable are heavy for what's a fairly narrow need, and TanStack Table gives structure but not cell-nav/paste for free either). Scope: roving focus across a 2D array of cells, type-to-edit, Enter/Tab/Escape semantics above, and a scroll-into-view hook that cooperates with `react-window`.
4. **Bulk paste as a first-class feature**, not an afterthought — this is likely the single highest-leverage feature for the "many entities, one field" job, since it lets someone fix data in an actual spreadsheet and paste the column back in.

## 6. Open questions to settle before scoping further

- **Which fields belong as grid columns?** Full `EntitySummary` breadth, or a curated subset per kind (person columns differ meaningfully from place columns)?
- **Does the grid need per-cell validation/formatting** (e.g. date fields, authority id lookups) or is it plain-text-in/plain-text-out with validation deferred to blur, like a real spreadsheet?
- **Does grid mode need multi-row selection + bulk operations** (e.g. select 10 rows, apply one nationality to all), or is "arrow to a cell, type, move on" enough for the near term?
- **Undo model** — spreadsheet users expect Cmd+Z to undo the last cell edit. Does that plug into anything existing, or is it new state to design?
- **Where does authority-linking fit?** Linking/unlinking an authority id doesn't fit a plain-text cell well (it's more like an autocomplete/lookup) — likely stays a click-driven affordance even inside an otherwise keyboard-driven grid.

## 7. Relationship to existing docs

| Document                                                                 | Role                                                                                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [entity-database-viewer-planning.md](entity-database-viewer-planning.md) | The shipped card viewer/editor this doc extends; defines `EntitySummary` and the existing sidebar/database-window split |
| **This doc**                                                             | Proposal for a keystroke-driven bulk-editing grid mode, distinct from the existing per-entity cards                     |
