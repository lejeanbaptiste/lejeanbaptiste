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

## 0.1.0-beta.2

### First-run and setup

- Welcome splash now includes a toggle for advanced features (direct XML editing).
- First-run no longer requires choosing an entity-database folder before you can continue: a working default is created deep in app data, and cloud-synced folders are suggested as an optional upgrade. Blank folders are accepted and scaffolded — install must never depend on already having installed, and creating a database must never depend on already having one.
- Simplified the slideshow of loading screens on startup.

### Auto-tagging

- Tag-bomb date filter now follows the same priority as disambiguation: (1) last user choice, (2) active file work year from TEI metadata, (3) no filter. It no longer defaults to the Eastern Han dynasty range.
- Date filters on tag bomb and Disambiguate now cast a slightly wider net than the slider shows: lookup quietly adds 100 years (exclude starts later; limit expands both ends). The UI still shows the nominal cutoff — e.g. exclude-from-500 behaves as 600 under the hood — so near-contemporaries are less likely to vanish now that pack floruit/index years no longer count as birth/death.
- Group & Clean no longer rolls a fief `placeName` into the rank `roleName` inside `<nobleTitle>`; fief and rank stay siblings so ranks do not pollute the offices table.
- Inside `<nobleTitle>`, Disambiguate only queues `placeName`s. Bare ranks auto-resolve (unique PEDB office key, else a Norbert office `ref`); place + role + posthumous can auto-resolve a person when the title maps uniquely. A posthumous name alone does not enter the person queue.
- Chinese projects now treat both Norbert and East Asian dates (`cjk-dates`) as required language plugins: Norbert alone no longer counts as “plugins installed”, so a fresh Chinese project re-prompts / retries until calendars are present too. Enabling also merges the Sanmiao schema contribution (as Japan already did).

### Performance and stability

- Serialised boots to avoid a TinyMCE load race that leaves LJB without an editor pane.

### Editor

- Editor pane now follows the programme's light/dark choice, rather than independently following the OS.
- Fixed: save timestamp was not putting `@version` on `<application>`, causing a validation error in Source mode.
- Monaco now auto-inserts the appropriate closing tag on `</`.
- Fixed entity mentions inserted via the toolbar button landing at the start of the unit instead of at the cursor (including a follow-up where focusing the editor after the entity fetch overwrote the saved caret).
- Lock Text no longer blocks the cursor: it keeps the primary source `contenteditable` instead of pulling it, so caret placement and arrow-key navigation work again while locked. Edits are still blocked via the same input/paste/composition/drop guards TinyMCE's own readonly mode uses; tagging and translation editing are unaffected, as neither relied on `contenteditable=false`.

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

- Fixed dynasty / floruit / index pack years being imported as if they were birth and death (again). Only `dateSource: 'fine'` biographical years become person vitals; year `0` (CBDB’s unknown sentinel) is rejected; backfill prefers Wikidata/CBDB lifespan over polluted Central/user dates; the sidebar and entity summaries skip year `0`.
- Card “backfill from authorities” no longer skips the CBDB pack when the A6 reference sqlite is missing: family/given (姓/名) are restored even if they were withdrawn by Central mirror sync, non-fine CBDB birth/death rows (e.g. Southern Qi 479–502 on 陳顯達) are cleared, and the primary lifespan prefers Wikidata then DILA before CBDB so real TEI vitals surface over dynasty-span leftovers.
- Database Window / sidebar bulk backfill no longer tries to ship the full CBDB persons pack (~570MB) into the renderer. It looks up only the linked authority ids in the main process, so select-all no longer hangs forever on “Reading packs…” and then does nothing.
- Long Database Window jobs (backfill, hygiene scan, …) keep running if you switch back to the editor: progress and cancel appear in the bottom bar, same pattern as AI runs and bulk sync.
- Offices are no longer minted with person 姓/名 splits or person-style pinyin (e.g. 平北將軍 → Ping Beijiangjun). The card hides those name types, offers a refresh button, and refresh scrubs leftover family/given rows while repairing the romanization to a concatenated office form.
- Office English/French roleName glosses (CBDB, Huckbot5000, MaxiRicci7000) are written onto entity cards on mint and on refresh. CBDB’s `[Not Yet Translated]` placeholder no longer blocks Huckbot fill, and is never stored as a translation.
- Attributes panel Lookup is available for `roleName` (office) as well as `placeName`, `orgName`/`org`, and `title` — it no longer depends on the schema mapper recognising the tag.
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
- Office entities can now carry a date range (same date form as works, now offered for offices too), and the auto-tagging disambiguation panel shows each candidate's date range or dynasty when picking between period-specific offices — e.g. distinguishing two entities sharing a title but from different eras. Nothing to render or configure otherwise: which office you tag is which translation you get.

### UI and settings

- Find: active hit now also marks the containing editor line with thick red vertical bars (in addition to orange inline highlight), so matches stay visible when entity/tag highlighting competes on the same row.
- Settings panel overhaul.
- Removed legacy popups ('Hey, looks like you're copying... Do you want to learn about copying?').
- Removed legacy help pop-ups.

### Rewards system

- Medal unlock toasts are held until you save a portrait in Service Record; medals still unlock and persist in the background, and waiting notifications are delivered after the first portrait save.
