# Find & Replace — planning notes

**Status:** Find shipped. Replace phase 2a (raw XML text-run replace) shipped. Replace phase 2b (WYSIWYG visible-text) not yet started.  
**Scope:** Desktop sidebar **Find** tab (`Explorer | Find | XPath`)

---

## Phase 1 (done)

### UI

- **Find** and **Replace** text fields (Replace disabled until phase 2)
- **Scope** dropdown — same as XPath: Current file / Open tabs / Project / Custom
- **Use regular expression** checkbox
- **Find** button; Enter in Find field runs search
- Grouped, collapsible **hits list** (file → matches with line:column + snippet)
- Arrow-key navigation through results; click or Enter jumps to hit
- Match count summary (“N matches in M files”)

### Search behaviour

- Always searches **raw XML text** (`openTabs[].content` or `readFile()`), never the WYSIWYG editor DOM — avoids the XPath editor/raw mismatch (see `docs/xpath-sidebar-planning.md`).
- Literal or regex mode (`textSearchUtils.ts`).
- Invalid regex → inline error message.

### Navigation (phase 1)

- Selecting a hit **opens/switches to that file’s tab** via `openFile`.
- Maps the hit’s **source offset** to a TEI xpath (`resolveTextHitInXml.ts`), finds the element in the WYSIWYG editor (`teiXPathWalker`), and **selects + scrolls** to the matched text (`selectTextInEditor.ts`). Sidebar keeps focus (`focusEditor: false`).
- First hit is jumped to automatically after each search.

### Key files

| File | Role |
|------|------|
| `apps/commons/src/desktop/sidebar/SidebarFindTab.tsx` | Find tab UI |
| `apps/commons/src/desktop/find/searchText.ts` | Multi-scope text search |
| `apps/commons/src/desktop/find/textSearchUtils.ts` | Literal/regex scan, snippets, line/column |
| `apps/commons/src/desktop/find/useFindNavigation.ts` | Tab switch + pending jump retries |
| `apps/commons/src/desktop/find/resolveTextHitInXml.ts` | Source offset → TEI xpath + text offsets |
| `apps/commons/src/desktop/find/selectTextInEditor.ts` | Select + scroll in WYSIWYG editor |
| `apps/commons/src/desktop/find/performFindJump.ts` | Orchestrates resolve + select |
| `apps/commons/src/desktop/shared/searchScope.ts` | Shared scope type + labels |
| `apps/commons/src/desktop/shared/ScopeFields.tsx` | Shared scope dropdown (XPath + Find) |

---

## Phase 2a — Source raw XML replace (done)

Raw XML replace on **single text-run** matches only (no `<`/`>` in matched slice; `resolveTextHitInXml` succeeds). Works from sidebar regardless of view mode; syncs Source Monaco or reloads WYSIWYG when the active file changes.

### UI

- **Replace** field + **Replace** / **Replace all** buttons
- Caption when selected hit crosses markup: not replaceable in this mode
- After replace: re-run search; advance selection

### Replace logic

| File | Role |
|------|------|
| `find/replaceText.ts` | `isReplaceableTextHit`, `replaceHitAtOffset`, `replaceAllInContent`, regex `$1` substitution |
| `find/replaceValidation.ts` | `validateAndReplaceHit`, `validateAndReplaceAll`, `parseXmlDocument` |
| `find/applyReplaceToEditor.ts` | Tab/source/visual/disk sync |
| `find/useFindReplace.ts` | Hook wired from `SidebarFindTab` |

- Single replace: splice `[hit.start, hit.end)` with replacement string
- Regex replace: `$1`, `$2`, `$$` in replacement string
- Replace all: open tabs → `updateTabContent` + dirty; closed files → `electronAPI.writeFile`
- Reject if `parseXmlDocument(newContent)` fails

### Sync with editor

1. Update `openTabs[].content` via `updateTabContent`
2. `markTabDirty(true)` for open tabs
3. Active file in Source mode → `setSourceCurrentContent`
4. Active file in WYSIWYG → `loadDocumentInWriter`

---

## Phase 2b — WYSIWYG visible-text replace (future)

Find/replace on **visible text** only (tags invisible), preserving inline markup. Example: find `中国` in `中<place>国</place>`, replace with `泰国` → `泰<place>国</place>`. Requires a visible-text index shared by find and replace; not part of phase 2a.

---

## Phase 3 — Editor highlight

- Map `line` / `column` / `start` offset → scroll Raw XML or WYSIWYG selection
- Options: Monaco in edit-source dialog, future full-file code view, or TEI xpath parent for coarse WYSIWYG highlight
- See XPath cross-file jump notes — text offsets in XML ≠ editor DOM positions

---

## XML validation on replace (phase 2+)

Goal: **reject replacements that break well-formed XML**, especially when the user could corrupt markup.

### When to validate

| Action | Validation |
|--------|------------|
| **Replace** (single) | Validate **after** replace on that file before committing; revert + toast on failure |
| **Replace all** | Validate **each file** after all replacements in that file; skip file or abort batch on failure |
| **Find only** | No validation |

Rapid per-replace validation is cheap (parse one file string). Batch “replace all” validates once per modified file, not once per hit.

### How to validate

Use the same approach as elsewhere in the app:

```typescript
const parseXmlDocument = (content: string): Document | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  if (doc.querySelector('parsererror')) return null;
  return doc;
};
```

If `parseXmlDocument(newContent)` returns `null` → **reject** the replace and show:  
“Replace would produce invalid XML. No changes were saved.”

### Risk tiers (when to warn vs always validate)

| Tier | Condition | Action |
|------|-----------|--------|
| **Low** | Literal find; match text has no `<`, `>`, `&` | Still validate parse after replace (cheap) |
| **Medium** | Literal find; match spans markup-looking characters | Validate + optional confirm dialog |
| **High** | **Regex enabled** | Always validate; consider extra confirm for `.*`, `.+`, `[^<]+` patterns |
| **High** | Find/replace string contains `<`, `>`, `/`, or attribute-like `=` | Warn: “This may alter XML structure” |

### Regex patterns that almost always need scrutiny

- `.*`, `.+`, `[\s\S]*` — can span tags
- Patterns matching `<` or `>` — cross element boundaries
- Replacements containing `<tag` or `/>` — inject markup

Suggested helper `getReplaceRiskTier(find, replace, useRegex): 'low' | 'medium' | 'high'` in `find/replaceValidation.ts`:

```typescript
const MARKUP_CHARS = /[<>/&]/;
const GREEDY_REGEX = /\(\.\*|\(\.\+|\\\.\\\*|\\\.\\\+/;

export const getReplaceRiskTier = (find: string, replace: string, useRegex: boolean) => {
  if (useRegex && GREEDY_REGEX.test(find)) return 'high';
  if (MARKUP_CHARS.test(find) || MARKUP_CHARS.test(replace)) return 'high';
  if (useRegex) return 'medium';
  return 'low';
};
```

### Replace-all batch policy

1. Compute all replacements per file in memory
2. Apply to a **copy** of content
3. `parseXmlDocument(copy)` — if fail, **do not write** that file; record error in summary
4. On success: write buffer, update open tabs, mark dirty
5. Show summary: “Replaced 42 occurrences in 8 files. Skipped 2 files (invalid XML).”

### Optional stricter mode (later)

- TEI/CWRC schema validation after replace (Relax NG) — slower; only for “strict project” setting
- Dry-run preview listing files that would become invalid

---

## Shared infrastructure with XPath

| Shared | Notes |
|--------|--------|
| `SearchScope` | `shared/searchScope.ts` |
| `ScopeFields` | Scope dropdown + custom folder path |
| `collectXmlFiles` | Project/custom file enumeration |
| Hits list UX | Same collapse/keyboard pattern as XPath tab |

Find **does not** reuse `useXPathJump` — text hits use line/column, not xpath/id.

---

## Manual test plan (phase 1)

1. Open a project with several XML files.
2. Find tab → literal search (e.g. `<p>`) → **Current file** → results + line numbers.
3. **Open tabs** / **Project** scope → grouped results across files.
4. Arrow keys move selection; sidebar keeps focus.
5. Click result in another file → tab switches.
6. Enable **regex** → search `\w+` → matches listed; bad pattern → error.
7. Custom scope → folder path → search works.

---

## Open questions

1. Should find be case-sensitive by default, with a “Match case” checkbox?
2. Persist last find/replace/scope in session or project file?
3. ~~For replace-all on disk-only files (not open), write via `electronAPI.writeFile` without opening tab?~~ **Yes** — phase 2a writes closed files directly.

---

## Summary

Phase 1 delivers **find across scopes** with a **hits list** and **tab navigation**, searching raw XML only. Phase 2a adds **raw XML replace / replace all** with **DOMParser well-formedness checks**. Phase 2b adds **WYSIWYG visible-text replace**. Phase 3 adds **editor highlight** at line/column.
