# Tag boundary keyboard navigation

## Goal

Two-stop cursor navigation for XML tag brackets in show-tags mode.
The caret stops twice at each tag boundary:

```
From left (ArrowRight):
  1. |<tag>Jean        normal caret, mild bracket highlight
  2. [<tag>]Jean       tag selected, vivid highlight (Backspace/Delete unwrap tag)
  3. <tag>|Jean        caret enters tag at first char

From right (ArrowLeft):
  1. Jean<tag>|        normal caret, mild bracket highlight  (symmetric)
  2. Jean[<tag>]       tag selected, vivid highlight
  3. Jean|<tag>        caret lands before tag (skips tag entirely)
```

Deletion semantics at each position:
- Position 1 (mild): Backspace/Delete act on adjacent characters normally.
  Backspace is blocked if it would cross the bracket; Delete is blocked symmetrically.
- Position 2 (vivid): both Backspace and Delete remove the tag.
- Position 3 (inside tag / before tag): normal character editing resumes.


## Implementation

All code lives in `packages/cwrc-leafwriter/src/js/tinymce/tinymceWrapper.ts`.
CSS for the visual states is in `packages/cwrc-leafwriter/src/css/build/editor.css`.

### State variables

```typescript
let currentBoundaryElement: Element | null  // tag being highlighted
let currentBoundaryIsExternal: boolean      // cursor is in adjacent text (not inside tag's own text)
let currentVirtualExternal: boolean         // second stop (vivid) is active

let _keydownBoundaryWasVirtualExternal: boolean  // snapshot of virtualExternal at keydown time
let _pendingAdvance: { node: Node; offset: number } | null  // advance target (see below)
```

### Key mechanisms

**`updateTagBoundaryState()`** — reads the TinyMCE selection and sets `currentBoundaryElement`
plus `currentBoundaryIsExternal`. Called on every `NodeChange`, `mouseup`, and arrow/backspace
`keyup`. The mild `tag-at-boundary` CSS class is applied automatically whenever the caret is
adjacent to a tag boundary. No press is required for the mild highlight.

**`setVirtualExternal(true)`** — adds the `tag-external-active` CSS class (vivid highlight).
Called in `onKeyDownHandler` when the first outward arrow press is detected.

**`_pendingAdvance`** — the advance cursor target is computed in `onKeyDownHandler` (before
TinyMCE moves the cursor) but applied at the top of `onKeyUpHandler` (after TinyMCE's own keyup
entity-navigation has already run). This is necessary because TinyMCE's `keyup` entity-navigation
fires before our `keyup` handler and will bounce cursor back out of the entity if we attempt
`setRng` in `keydown`.

**TinyMCE entity-navigation bounce at offset=1** — when pressing ArrowLeft from offset=1 inside
entity text, TinyMCE's keyup bounces cursor to just before the entity. We intercept this in
`keydown` with a separate block (outside the main boundary block, which only fires when
`currentBoundaryElement` is set) and set `_pendingAdvance = { node: container, offset: 0 }` to
land at the internal start boundary instead.


## Known bugs (as of 2026-06-29)

### Bug A — advance to inside tag (ArrowRight, position 2→3) loops back to position 1

**Symptom:** pressing ArrowRight three times from the opening bracket:
```
1. |<persName>Jean    (mild)
2. [<persName>]Jean   (vivid)
3. |<persName>Jean    (back to mild — same visual as position 1!)
4. <persName>J|ean    (inside tag, but at offset=1 not offset=0)
```

**Root cause:** `_pendingAdvance` correctly places cursor at `TEXT("Jean") offset=0` inside the
entity. Then `doHighlightCheck` is called (current order: pendingAdvance → doHighlightCheck →
updateTagBoundaryState). `doHighlightCheck` detects the cursor is inside an `[_entity]` element
and calls `writer.entitiesManager.highlightEntity(id, writer.editor.selection.getBookmark())`.
TinyMCE's `getBookmark()` at offset=0 inside an entity inserts a `data-mce-bogus` marker span
**before** the entity, then `highlightEntity` (or its eventual `moveToBookmark` call) restores
cursor to that marker — i.e. just before the entity. This cancels our `_pendingAdvance` placement.

`updateTagBoundaryState` then sees cursor before the entity and shows the opening bracket
highlight again (position 1).

**What we tried:**
- Setting `_pendingAdvance` target in `keydown`, applying in `keyup` — works for positions that
  stay in external text but fails for positions that enter the entity because `doHighlightCheck`
  moves cursor after `_pendingAdvance`.
- Calling `setRng` directly in `keydown` — overridden by TinyMCE's `keyup` entity-navigation.

**Potential fixes:**
1. Swap order to `doHighlightCheck → _pendingAdvance → updateTagBoundaryState`. `doHighlightCheck`
   runs on whatever bounced position TinyMCE left cursor at; `_pendingAdvance` then overrides it.
   Downside: entity panel highlight may not update when entering via keyboard.
2. After `_pendingAdvance` sets cursor inside entity, skip the `doHighlightCheck` call (only call
   `updateTagBoundaryState`). Re-trigger entity panel update via a separate `NodeChange` dispatch
   or direct `entitiesManager.highlightEntity(id)` call without passing a bookmark.
3. Understand and suppress the `moveToBookmark` side effect inside `highlightEntity`. Requires
   reading `entitiesManager.highlightEntity` to confirm it actually calls `moveToBookmark`.
4. Use a `setTimeout(..., 0)` to apply `_pendingAdvance` after all synchronous TinyMCE handlers
   (including any `highlightEntity` callback) have completed.

### Bug B — typing at offset=0 adjacent to entity inserts inside entity

**Symptom:** cursor at offset=0 of text immediately after `</tag>` (external closing bracket,
position 1 from right). Typing a character inserts inside the entity instead of outside it.
Space gives `<tag>Jean </tag>problem` (space injected into entity, leading space of following
text removed).

**Root cause:** TinyMCE's `CaretContainer` / entity-navigation logic treats offset=0 adjacent to
an entity end as a "fake caret" and routes typed characters into the entity.

**Potential fixes:**
1. Intercept `keypress` or `beforeinput` events at the boundary and call `setRng` to an
   unambiguous position (e.g. offset=1 or a zero-width non-joiner anchor) before allowing input.
2. Insert a zero-width space (U+200B) immediately after the entity's closing boundary in the DOM
   so TinyMCE has a real, non-adjacent text node to type into. Remove it on blur/save.
3. Use TinyMCE's `editor.selection.setCursorLocation(node, offset)` which may handle fake-caret
   disambiguation better than a raw `setRng`.

### Bug C — cursor exits entity after first-char deletion

**Symptom:** cursor inside entity at offset=0 (`<tag>|Jean`). Delete removes 'J', cursor should
remain at offset=0 of 'ean' inside tag. Instead cursor exits entity. Next typed character lands
before the tag.

**Root cause:** TinyMCE's `NodeChange` / entity-mutation observer moves cursor out of entity
after content is deleted near the entity boundary. Exact handler unknown.

**Potential fixes:**
1. Intercept `keyup` for Delete when `currentBoundaryElement` is set and cursor was at
   `isAtTextStart`; after TinyMCE has processed the deletion, force cursor back to offset=0 of
   the (now modified) text node inside the entity.
2. Wrap the Delete key action in `editor.undoManager.ignore()` or equivalent to suppress
   TinyMCE's mutation-triggered cursor correction.

### Bug D — (fixed) ArrowLeft from offset=1 inside entity exits entity

**Status:** Fixed. Intercepted in `keydown` when `!currentBoundaryElement && offset===1 &&
isTagOrCombinedEl(parent)`. `_pendingAdvance` forces cursor to offset=0 (internal start
boundary) in `keyup`.

### Bug E — (fixed) getPreviousTextNode from entity element re-enters entity subtree

**Status:** Fixed. Was using `getPreviousTextNode(currentBoundaryElement)` which, starting from
the element, returned its own last text child. Changed to
`getPreviousTextNode(currentBoundaryElement.firstChild ?? currentBoundaryElement)` to start
inside the entity's first child, so `previousNode()` steps past the opening boundary.

### Bug F — (fixed) infinite loop when tag is at document boundary

**Status:** Fixed. `event.preventDefault()` is now only called when an advance target is found.
If `getNextTextNode`/`getPreviousTextNode` returns null, the key event falls through and cursor
moves naturally.


## Files changed

| File | Description |
|---|---|
| `packages/cwrc-leafwriter/src/js/tinymce/tinymceWrapper.ts` | All navigation logic |
| `packages/cwrc-leafwriter/src/css/build/editor.css` | `tag-at-boundary` and `tag-external-active` CSS |


## Deferred

- Remove `console.log` debug statements from `tinymceWrapper.ts` before merging.
- Investigate `writer.entitiesManager.highlightEntity` to confirm whether it calls
  `editor.selection.moveToBookmark` and under what conditions.
- Decide whether position 3 from left (inside tag at start) and position 3 from right (before
  tag) should be symmetric (both enter tag) or asymmetric as currently implemented.
