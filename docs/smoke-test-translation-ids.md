# Smoke test — translation ids, undo separation, recovery

Covers the hash-at-birth id change, the undo exclusion for indexing writes, the
`schema/translation-index.json` snapshot, and tier-1 external-change recovery.
Takes ~10 minutes. Run in the desktop app.

## Setup

1. Create (or open) a project with translation configured: Project → Edition metadata →
   add at least one language (e.g. French), alignment unit `p`.
   **Verify before starting**: `schema/translation-settings.json` in the project root must say
   `"alignmentUnit": "p"`. The unit is locked at first configuration — with `"div"` the whole
   div is the single alignment unit (one id on the div, none on the paragraphs) and every
   paragraph-level step below will appear to fail. Use a fresh project if it says `"div"`.
2. Create a source file `smoke.xml` with a body containing four paragraphs, two of them
   identical, none with `xml:id`:

   ```xml
   <p>Alpha paragraph.</p>
   <p>Beta paragraph.</p>
   <p>Amen.</p>
   <p>Amen.</p>
   ```

3. Save it, keep it open.

## 1. Bootstrap + hash ids + snapshot

- Open `smoke.xml`, open the Translation tab, pick the language.
- **Expect:** in source view every body `<p>` now has `xml:id="twu-<16 hex chars>"`;
  the two `Amen.` paragraphs share the same hash with the second suffixed `-2`.
- **Expect:** `smoke.fr.xml` (companion) exists with matching `corresp="smoke.xml#twu-…"`.
- **Expect:** `schema/translation-index.json` exists and lists 4 units for `smoke.xml`
  with `id`, `contentHash`, `index`, `preview`.
- Translate one paragraph in the pane; confirm it persists into the companion file.

## 2. Undo exclusion (source mode)

- In **source** view, split `Alpha paragraph.` into two `<p>`s (duplicating nothing) and save.
  The reindex assigns the new paragraph an id and reloads the tab.
- Press Cmd+Z repeatedly.
- **Expect:** the new `xml:id` does **not** disappear — undo history was reset by the
  reindex reload; typing/undo afterwards behaves normally.
- Sanity check that ordinary undo still works: type some text, Cmd+Z reverts it.
- Sanity check find-replace: replace a word via the Find panel, Cmd+Z reverts the
  replacement (find-replace must remain undoable).

## 3. Id idempotence (self-healing)

- In source view, delete the `xml:id="…"` attribute from `Beta paragraph.` (leave the text
  untouched). Save.
- **Expect:** the exact same id comes back (compare with the companion's `corresp`), and the
  translated content in the pane is still attached to that paragraph.

## 4. Split-paragraph reindex

- In the visual editor, split a translated paragraph in the middle. Save.
- **Expect:** first half keeps the original id and its translation; second half gets a fresh
  hash id and an **empty** translation unit (it must not inherit a copy).

## 5. External scramble + tier-1 recovery

- With `smoke.xml` open in the app, strip all ids from a terminal:

  ```sh
  sed -i '' 's/ xml:id="twu-[^"]*"//g' /path/to/project/data/smoke.xml
  ```

- Return to the app window.
- **Expect:** a snackbar — "Restored N translation links after external change" — where
  N = 2 or 3 (the unique paragraphs; see next step), followed by the normal
  "file changed on disk" reload prompt. Reload.
- **Expect:** unique paragraphs (`Alpha…`, `Beta…`) have their **original** ids back and
  translations still attached.
- **Expect:** the two identical `Amen.` paragraphs were **not** guessed at (duplicate hashes
  are never anchors); they get fresh ids at the next save instead, and their reindexed
  companion units start empty.

## 6. Save As

- Save As `smoke-copy.xml` while the Translation tab is open.
- **Expect:** no stale/duplicate ids in the new file; `translation-index.json` gains an entry
  for `smoke-copy.xml` after its first reindex-triggering save.

## Pass criteria

Every **Expect** above holds; nothing in steps 2–5 ever deletes translated text from the
companion file (worst case a unit is re-linked or left for fresh indexing — never purged).
