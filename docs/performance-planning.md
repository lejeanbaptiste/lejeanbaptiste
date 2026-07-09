# Performance Optimization — planning notes

**Status:** Planning only  
**Scope:** Desktop app and shared LEAF-Writer runtime  
**Related:** `docs/bundle-size-warning-planning.md`, `docs/find-replace-planning.md`, `docs/tagging-planning.md`

---

## Summary

The app already has one important optimization in place: the markup tree is virtualized with
`react-virtuoso`. That means the next wins are less about adding virtualization everywhere by
default and more about targeting the remaining hotspots:

- long review/disambiguation lists that still render eagerly,
- heavyweight editor lifecycle churn,
- full tree-model rebuilds for large XML documents,
- hidden-but-mounted panels that retain memory,
- polling-based desktop bridge code that adds idle work.

This document proposes a phased plan that prioritizes user-visible responsiveness first, then memory
retention, then lower-level structural cleanup.

---

## What we found

### Already optimized

The markup tree panel is already virtualized:

- `packages/cwrc-leafwriter/src/panels/markup/tree/SortableTree.tsx`

That is good news because it avoids wasting time on a problem that has already been addressed.

### Highest-value remaining candidates

#### 1. Auto-tagging review panel still renders the full list

The review pane maps every pending group directly into the DOM:

- `packages/cwrc-leafwriter/src/autoTagging/ReviewPanel.tsx`

This is likely to hurt when a document produces many suggestions, especially because each row
contains multiple MUI components, buttons, chips, and conditional status UI.

#### 2. Disambiguation panel still renders the full list

The disambiguation pane eagerly renders:

- all pending groups,
- all resolved groups,
- all visible instances in expanded groups,
- all candidate rows for the selected group.

Key file:

- `packages/cwrc-leafwriter/src/autoTagging/DisambiguationPanel.tsx`

This is a strong candidate for virtualization or staged rendering because the panel can grow with
project size and authority density.

#### 3. Monaco editor is recreated on theme changes

The source editor creation effect depends on theme state:

- `packages/cwrc-leafwriter/src/components/sourceEditor/XmlMonacoEditor.tsx`

That means a theme switch tears down and recreates the Monaco instance, which is expensive in both
CPU and transient memory. The editor can instead be created once and updated in place when the theme
changes.

#### 4. Markup tree virtualization does not remove tree rebuild cost

The tree UI is virtualized, but the underlying tree model is still:

- rebuilt from the editor DOM,
- flattened in memory,
- filtered again for visibility.

Key file:

- `packages/cwrc-leafwriter/src/panels/markup/tree/useTree.ts`

This means very large XML files may still pay a heavy rebuild cost even if only a small viewport is
rendered.

#### 5. Desktop bridge code uses polling and repeated DOM lookup

Several desktop integration paths rely on repeated checks:

- `packages/cwrc-leafwriter/src/App.tsx`
- `apps/commons/src/desktop/DesktopEastPanels.tsx`
- `apps/commons/src/desktop/UnifiedRightPanel.tsx`

These loops are probably not the primary bottleneck during editing, but they do add idle work and
make lifecycle behavior more fragile.

#### 6. Some hidden panels intentionally stay mounted

The left panel keeps mount points alive to avoid breaking portals:

- `apps/commons/src/desktop/UnifiedLeftPanel.tsx`

This is understandable, but it also means inactive panels may continue to hold state, DOM, and
subscriptions longer than necessary.

---

## Goals

We should optimize for the following, in order:

1. Faster interaction in large review/disambiguation sessions
2. Lower memory growth when switching panels or documents
3. Less expensive editor and panel lifecycle transitions
4. Better scalability for very large TEI/XML files
5. Less idle CPU from polling and repeated DOM queries

---

## Proposed phases

## Phase 1 — Virtualize the biggest remaining lists

**Priority:** High  
**Expected payoff:** High user-visible responsiveness improvement

### Targets

- `packages/cwrc-leafwriter/src/autoTagging/ReviewPanel.tsx`
- `packages/cwrc-leafwriter/src/autoTagging/DisambiguationPanel.tsx`

### Plan

- Add virtualization to pending suggestion groups in the review panel.
- Add virtualization to the top-level pending/resolved group lists in disambiguation.
- Preserve keyboard navigation, current-item focus, and preview behavior.
- Keep expanded-group contents simple at first; virtualize nested candidate lists only if needed.

### Why first

These panels are the clearest place where the app still creates a large amount of React/MUI work
eagerly, and they are directly tied to workflows where the user can generate hundreds of items.

### Risks

- Keyboard navigation can break if focus is tied to DOM nodes that unmount.
- Scroll-to-current behavior will need to cooperate with the virtualizer.
- Collapsible sections and variable row heights may complicate measurement.

### Success criteria

- Large suggestion batches stay responsive while scrolling.
- Accept/reject/select interactions remain instant.
- Keyboard review flow still works without focus glitches.

---

## Phase 2 — Reduce Monaco churn

**Priority:** High  
**Expected payoff:** Medium/high for source-mode users

### Target

- `packages/cwrc-leafwriter/src/components/sourceEditor/XmlMonacoEditor.tsx`

### Plan

- Create the Monaco editor only once per mount.
- Move theme updates into `editor.updateOptions(...)` or equivalent theme switching only.
- Review marker/decoration updates to avoid unnecessary collection recreation.
- Confirm listeners and disposables are cleaned up exactly once.

### Notes

The current code already has a separate effect for theme updates, which makes this a good candidate
for a focused refactor with limited behavior change.

### Success criteria

- Theme changes no longer recreate Monaco.
- Undo/redo and LSP wiring still behave correctly.
- No duplicated listeners remain after repeated mode/theme changes.

---

## Phase 3 — Make tree-model work more incremental

**Priority:** Medium/high  
**Expected payoff:** High on very large documents, moderate otherwise

### Target

- `packages/cwrc-leafwriter/src/panels/markup/tree/useTree.ts`

### Plan

- Measure how often full `getNodes(...)` rebuilds happen during normal editing.
- Cache more derived state so we do not repeatedly flatten the whole tree.
- Investigate expanding children lazily rather than materializing the full tree model up front.
- Consider targeted subtree updates after known edit operations instead of full rebuilds.

### Why not first

This is likely more invasive than list virtualization and easier to get wrong. The user-facing win
could be large, but only for sufficiently big documents.

### Success criteria

- Large documents no longer stall when the markup panel refreshes.
- Tree navigation remains correct after edits.
- Rebuild frequency and rebuild duration are measurably lower.

---

## Phase 4 — Trim retained memory in inactive panels

**Priority:** Medium  
**Expected payoff:** Better memory behavior over long sessions

### Targets

- `apps/commons/src/desktop/UnifiedLeftPanel.tsx`
- right-panel desktop panel containers
- React-only inactive tabs and auxiliary panes

### Plan

- Distinguish between mount points that must remain alive for legacy portals and panels whose heavy
  internals can safely suspend.
- Keep the outer container mounted where necessary, but allow expensive children to unmount or pause
  subscriptions when hidden.
- Audit global `window` bridges and listeners for panels that are often inactive.

### Success criteria

- Hidden tabs retain less live state and fewer subscriptions.
- Reopening a tab remains fast and correct.
- Legacy portal integration is not broken.

---

## Phase 5 — Replace polling with event-driven mounting where possible

**Priority:** Medium  
**Expected payoff:** Lower idle CPU, cleaner lifecycle code

### Targets

- `packages/cwrc-leafwriter/src/App.tsx`
- `apps/commons/src/desktop/DesktopEastPanels.tsx`
- `apps/commons/src/desktop/UnifiedRightPanel.tsx`

### Plan

- Replace `setInterval` retry loops with explicit lifecycle events where available.
- Use `MutationObserver` only where true event wiring is not feasible.
- Avoid repeated `querySelector(...)` scans once a container has been found and validated.
- Clean up any per-icon React roots or transient mounts that lack explicit teardown.

### Success criteria

- Less repeated DOM scanning after startup.
- Fewer timing-sensitive retries during panel migration.
- No regression in desktop panel mounting reliability.

---

## Measurement plan

Before and during implementation, we should gather a small baseline for the main workflows.

### Scenarios to profile

1. Open a large XML document and show the markup tree
2. Run auto-tagging with a large suggestion set
3. Open the disambiguation panel with many mention groups
4. Switch between WYSIWYG and source mode repeatedly
5. Collapse and reopen left/right panels during a long session

### Metrics to compare

- time to first usable panel render,
- scroll smoothness in long lists,
- memory footprint after opening and closing heavy panels,
- number/duration of tree rebuilds,
- CPU activity while idle after the editor is fully mounted.

### Tooling

- React Profiler for panel render cost
- browser/electron performance tools for scripting and paint
- heap snapshots for retained panel/editor state
- lightweight timing logs around tree rebuild and auto-tagging panel setup

---

## Recommended implementation order

If we want the best return with the least risk, the order should be:

1. Virtualize `ReviewPanel`
2. Virtualize top-level `DisambiguationPanel` lists
3. Stop recreating Monaco on theme changes
4. Measure and reduce full tree rebuild work
5. Reduce memory retained by inactive tabs
6. Replace polling-based desktop bridge code with event-driven wiring

---

## What not to chase first

Some optimization ideas are real but should not lead the plan:

- Re-virtualizing the markup tree — it is already virtualized.
- Micro-optimizing small utility loops before fixing large list rendering.
- Premature worker-lifecycle changes without evidence they are a dominant cost.
- Broad memoization everywhere without profiling; it can add complexity without helping.

---

## Open questions

1. What is the largest realistic suggestion/disambiguation batch we expect in production use?
2. Are large-document slowdowns dominated by tree rebuilds, validator work, or TinyMCE DOM sync?
3. Which inactive panels truly need to stay live because of legacy portal assumptions?
4. Do we want to optimize for lower steady-state memory, lower latency, or both equally?

---

## Suggested next step

Start with Phase 1 and profile one large real-world auto-tagging session before changing tree-model
internals. That gives us the clearest near-term win and a stronger baseline for deciding whether the
next bottleneck is list rendering, tree rebuilding, or editor lifecycle churn.
