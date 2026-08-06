# Le Jean-Baptiste changelog

## 0.0.1–0.0.4-rc.7

- Production and testing of alpha version, distribution chanels, automatic updates, and sibling repos until infrastructure stabilised.

## 0.1.0-beta.1

### Performance and stability

- Established performance baseline on slow Windows test machine
- Virtualised the auto-tagging review list
- App.tsx now keeps Monaco alive after its first Source-mode use, so subsequent Visual ↔ Source switches do not recreate it. Tested, big improvement.
- ui/actions.ts now returns directly to Visual mode when the source buffer is unchanged—skipping both validation and the expensive TinyMCE reload. Tested, big improvement.
- Tree panel work: Tried to improve performance, but with minimal gains. Added a switch to turn off live tracking for older hardware.
- Cut out intentional 1.5-second wait before loading the editor while at once racing with the XML it is trying to load.
- In Windows, command to quit is now carried out with but a slight delay.
- Lazy load panels to keep memory usage down.
- Share desktop schema/document preparation between initial editor setup and the first actual document load.
- Added manifest-driven, range-aware loading for large authority tag packs, with two-century chunks, two-block guard bands, and legacy-pack compatibility.
- Tag-bomb pack reads now bypass the reusable lookup cache, and chunk reads avoid temporary flattened copies. On the slow-machine cutoff test, peak memory fell from about 1.1 GB to 236 MB and the run became visibly faster.
- Cache Norbert wrapper/noble-title expansion across review sessions, invalidate it with authority-pack refreshes, and warm it only after the review pane is idle.
- Norbert review now requires noble titles first and person wrappers second; each stage refreshes against the edited document before ordinary category review is unlocked. Wrapper reconciliation now checks that both sides point to one live PEDB person key and leaves missing, conflicting, or ambiguous cases unresolved.
- Asset and plugin packs no longer overwrite one another for no reason 🤦‍♂️

### Functionality

- Rebuilt Sanmiao date validation panel to work _with_ the script, setting fixed waypoints to calculate around and allowing the user to enter missing date data (needs testing.)

### Data

- New items in shared, synchronised project now hydrade an older central database by default rather than insisting that tags be stripped 🤦‍♂️
- Consolidated the database viewer, added note taking.
- Worked out merge conflict mechanics and wiring.
- Added notes to database elements
- Wired fork-merge menu entry
- Bridge conflict “pick a value” UI
- i18n for new sync/dialog strings
- SQLite is now required for live entity indexing, lifecycle checks, and entity counts; XML remains explicit interchange/import-export material
- Avoid full panel reloads on single-field edits
- Finished wordprocessor write paths against SQLite
- Automatically keep ordinary entity-name writes clean: deduplicate same text/type rows, discard literal `nan` placeholders, and remove the malformed `n` + `an` family/given pair. The Clean command still catches older data too.
- Isolated and parsed 3,142 names in authority packs constituting noble titles.
- Rewired database intake process to distinguish between 'display' and 'primary name' and to treat noble titles as distinct from 姓名.
- Ran entity sync test to ensure data integrity under different synchronisation scenarios.
- Compiled full CBDB, Wikidata, VIAF, NDL concordance for authority packs.

### UI

- Monaco now opens with the panels collapsed, cannot scroll down to infinity.
- Made plugin enablement project-specific, filtered the Plugins panel by the project's source
  language, and removed plugin-specific entries from the native Tools menu.
- Removed the tag-boundary undo/redo debug logs.
- Ranked tag-command prefix matches ahead of partial tag-name matches.
- Propagate now matches across visible inline markup, reproduces nested visible tag structure, preserves existing hidden/correction markup, and skips partially pre-tagged occurrences.
- Added a Norbert-branded noble-title action to the selection tag popup when the Norbert plugin is enabled.
- Added a matching Norbert-branded person-wrapper action; filtering for “person” or “wrapper” finds it.
- Database viewer now shows authority badges
- Blocked disambiguation map from zooming outside of tile range
- Cleaned up entities viewer UI a little.

### Rewards system

- Lowered bar on two items. Rules should be fixed moving forward.

### Documentation

- Cleaned and provided public-facing documentation, including beta tester guide.

### Patch Changes

[924a08a]

- **Update to Reac 18**
  - Update dependencies

[924a08a]

- Updated dependencies
  - @cwrc/leafwriter@1.2.0
  - @cwrc/leafwriter-storage-service@1.1.0

## Upstream

### First-run and setup

- Welcome splash now includes a toggle for advanced features (direct XML editing).
- First-run no longer requires choosing an entity-database folder before you can continue: a working default is created deep in app data, and cloud-synced folders are suggested as an optional upgrade. Blank folders are accepted and scaffolded — install must never depend on already having installed, and creating a database must never depend on already having one.
- Simplified the slideshow of loading screens on startup.

### Performance and stability

- Serialised boots to avoid a TinyMCE load race that leaves LJB without an editor pane.

### Editor

- Editor pane now follows the programme's light/dark choice, rather than independently following the OS.
- Fixed: save timestamp was not putting `@version` on `<application>`, causing a validation error in Source mode.
- Monaco now auto-inserts the appropriate closing tag on `</`.
- Fixed entity mentions inserted via the toolbar button landing at the start of the unit instead of at the cursor (including a follow-up where focusing the editor after the entity fetch overwrote the saved caret).

### Translation panel

- Added LanguageTool spelling and grammar correction.
- Added card flow.
- Fixed buggy footnotes changing place and eating body text.
- Added entity insertion and automatic formatting.
- Translation pane UI overhaul.
- AI translation now grounds tagged names against the entity database instead of guessing them: the model gets each tagged entity's canonical record and emits a placeholder in its place, which is then swapped for a real, correctly formatted entity field.
- Fixed a save error ("provided markup is invalid XML") that could hit when persisting translation-pane edits — swapped a fragile HTML-string round-trip for a direct DOM import.
- Fixed the translation pane opening blank after leaving the tab (e.g. to edit the entity database) and coming back — re-enter translation mode when the tab is selected again.

### Entity display and data

- Entity display formatting is now kind-aware: places, organisations, offices, and works no longer get the person-only family/given name split. Dates are shown only for people and works (births/deaths and publication dates respectively); places, organisations, and offices never display a dates part.
- Wired up two entity fields that were being silently dropped: generic (non birth/death) existence dates now reach works' entity records instead of being lost, and office classification labels are now surfaced on office entities.
- Added a `work_type` field (book, chapter, poem, painting, object) to entity records, with citation styling to match: books and paintings render in italics, chapters and poems in curly quotes.
- Work entities now default to type `book` (italics) when unset; existing nulls are backfilled on schema migration 7.
- Work-title italics apply only to the romanization: Chinese characters and an English possessive ’s stay upright.
- Work (and other) mentions now append a matching-language translation gloss in parentheses after the Chinese characters, e.g. _Jinshu_ 晉書 (Livre des Jin), from the `entity_translations` table (with a dual-read fallback for legacy `translation` name rows).
- Place (and other) romanizations still lead the display when stored as `translation` + `*-Latn`, and when Latin text was mis-tagged under `zh-Hant`; those rows are no longer mistaken for the parenthetical gloss.
- Romanizations are now stored as name type `romanization` with a `*-Latn` language (schema migration 8 retags legacy `translation`/mis-tagged rows). Vernacular glosses stay `translation`.
- Automatic romanization is kind-aware: persons stay syllable Title Case (`Zhang Heng`); works/orgs/offices concatenate (`Jinshu`); places use a concatenated stem plus a lowercase admin suffix when recognized (`Jiankang jun`).
- Vernacular glosses (fr/en/…) now live in a dedicated `entity_translations` table (schema migration 9), so they no longer pollute name search/autocomplete. The entity editor still shows them as Translation rows; display prefers this table and still accepts legacy `nameType=translation` name rows.
- First-occurrence titles can lead with the vernacular gloss instead of the romanization (`Livre des Jin (Jinshu 晉書)`): per-mention toggle on the entity-display popup, plus a personal per-language default in Translation policy settings. Work italics follow the leading title.
- Missing translations get a dashed “add translation…” nudge in the entity editor (one chip per configured project language) and in the entity-display popup (for the active pane language). Neither inserts placeholder text into the document.
- On those nudge surfaces, “Suggest with AI” can fill the draft gloss for review; the user still saves or adds it. Never auto-writes to the entity store.
- The Database Window's bulk Wikidata refresh now pulls work titles for every language configured in Translation policy settings, not just English plus the desktop UI language. Also fixed: that refresh wasn't passing the desktop UI language at all, so in practice it only ever fetched English titles.

### UI and settings

- Settings panel overhaul.
- Removed legacy popups ('Hey, looks like you're copying... Do you want to learn about copying?').
- Removed legacy help pop-ups.
