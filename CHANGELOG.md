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
- Disambiguate date filter now falls back to Norbert `dynasties[]` years when `nationality` has labels but no dates — excluding after −78 no longer leaves Northern Zhou / Southern Qi people in as “undated.”
- Disambiguate AI curation defaults off and stays disabled until a verified AI API is configured (same idea as tag-bomb).

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
- East Asian date attributes (`LW.dateAuthority`) no longer show raw i18n keys in the attributes panel: synced full strings into commons and package locales, localised the gz helper text, and stopped a hardcoded English Sanmiao error from overriding the translated unavailable message.

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
- Removed the Disambiguate launcher popup — clicking Disambiguate now starts the review directly (AI curation and caching settings moved to where the rest of the app's settings live, see below).
- Added a small persistent **AI** toggle to the Disambiguate panel itself, between the tag filter and the refresh button, replacing the launcher's one-time checkbox. Persists across sessions (default off); forced on and non-interactive when **Always on** is set in AI API settings.
- New **Always on** option in Settings → AI API: when set, AI curation runs unconditionally wherever it's offered (currently Disambiguate) without a per-run opt-in toggle.
- When **Stream AI results** is off and AI curation is enabled, opening Disambiguate now also warms the AI ranking cache for every pending mention in the background (progress in the bottom bar) — the panel is usable immediately, this just makes navigating mention-to-mention feel instant once it catches up.
- Moved "Disable caching" for disambiguation out of the (now-removed) launcher popup into Settings → Garde-fous.

### Performance and stability

- Serialised boots to avoid a TinyMCE load race that leaves LJB without an editor pane.

### Editor

- Lock Text no longer undoes autotag apply: removed the IME composition snapshot→`setContent` revert (it raced with `loadDocumentXML` — tags flashed then the pre-apply body came back). Locked typing is still blocked via beforeinput / composition abort without rewriting the document. Also stop re-applying a stale init-time `document.xml` on every `documentLoaded`, always refresh the desktop stored XML snapshot after apply, and treat the tag-bomb `current` path sentinel as the live editor.
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
- AI translation now blinds tagged entities and Sanmiao dates in the source unit before the model sees them (`{{entity:KEY}}`, `{{date:N}}`, plus Norbert-aware `{{holding:…}}` / `{{as:…}}` for “title held + person appointed as office”). The model is sent only id/kind (and date indices)—never display names—so it cannot expand placeholders into invented wording. After the reply, placeholders become atomic LJBtero entity/date fields.
- Offices with a vernacular gloss default to that gloss alone (no pinyin or characters); other kinds keep their existing recipes. Central-card glosses merge into project entities for display.
- Unkeyed leftover spans (e.g. `<roleName>益州刺史</roleName>`) become `{{opaque:N}}` / `{{as:opaque:N}}`; `nobleTitle` (including nested place/role) is left as plain text for the model to translate until noble titles are wired as entities.
- Adjacent placeholders are spaced (`}} {{`) and double spaces collapsed. Smart-quoted mangled placeholders are repaired before substitute.
- If the model drops required placeholders, the pane resends up to a configurable **Placeholder retry limit** (Settings → AI API, 0–5; default 1). The first attempt always runs; the loop stops early when a retry does not improve the inventory.
- Strips leading temporal prepositions (In/On/…) before date fields and leading office paraphrases (Governor of/…) before entity placeholders when the model adds them anyway.
- Added a toolbar refresh button that re-resolves every LJBtero entity anchor (romanization, characters, translation, dates) against the database and clears cached office glosses, so edits made in the Database Window show up without reopening the pane. Also wired to F5.
- The IME-style autocomplete popup (type to insert an entity anchor) now also suggests Sanmiao date spans from the source unit. Since dates aren't in the entity database, the match keyword is a mechanical, on-the-fly pinyin romanization of the Chinese date text — never stored, purely a typing aid.
- Fixed a save error ("provided markup is invalid XML") that could hit when persisting translation-pane edits — swapped a fragile HTML-string round-trip for a direct DOM import.
- Fixed the translation pane opening blank after leaving the tab (e.g. to edit the entity database) and coming back — re-enter translation mode when the tab is selected again.
- AI translation now splits source `<note>` footnotes out of the main text before translating: each note is stripped to a `{{note:N}}` placeholder, translated independently (its own entities/dates blinded the same way as the main text), and re-inserted as a real `<note place="foot">` footnote — no code changes needed to the existing footnote numbering, it just picks these up like a manually inserted one. A note that fails to translate falls back to its original text rather than failing the whole run.
- **Stream AI results into review as each block finishes** now defaults on.
- New **Translate document** action alongside Generate translation: translates every still-blank unit in the document, one at a time, skipping any unit that already has real text. Progress shows in the bottom bar (same indicator used by background auto-tagging runs), with a cancel button.

### Entity display and data

- Fixed dynasty / floruit / index pack years being imported as if they were birth and death (again). Only `dateSource: 'fine'` biographical years become person vitals; year `0` (CBDB’s unknown sentinel) is rejected; backfill prefers Wikidata/CBDB lifespan over polluted Central/user dates; the sidebar and entity summaries skip year `0`.
- Lookup and backfill now attach Norbert↔CBDB/DILA/Wikidata bridge links from the shipped `norbert/concordance.ndjson` sidecar (and from pack `metadata.crosswalk` when present). This repairs Central entities that were imported with only a NORBERT id, and Lookup no longer skips concordance expansion when adopting a Central hit.
- When a bridge target is already on another Central person with the **same primary name** (typical after importing all of Norbert alongside CBDB/Wikidata), backfill merges the Norbert-only duplicate into that card so badges appear on one entity. Differently-named conflicts are counted in the backfill snackbar for review.
- Card “backfill from authorities” no longer skips the CBDB pack when the A6 reference sqlite is missing: family/given (姓/名) are restored even if they were withdrawn by Central mirror sync, non-fine CBDB birth/death rows (e.g. Southern Qi 479–502 on 陳顯達) are cleared, and the primary lifespan prefers Wikidata then DILA before CBDB so real TEI vitals surface over dynasty-span leftovers.
- Database Window / sidebar bulk backfill no longer tries to ship the full CBDB persons pack (~570MB) into the renderer. It looks up only the linked authority ids in the main process, so select-all no longer hangs forever on “Reading packs…” and then does nothing.
- Long Database Window jobs (backfill, hygiene scan, …) keep running if you switch back to the editor: progress and cancel appear in the bottom bar, same pattern as AI runs and bulk sync.
- Offices are no longer minted with person 姓/名 splits or person-style pinyin (e.g. 平北將軍 → Ping Beijiangjun). The card hides those name types, offers a refresh button, and refresh scrubs leftover family/given rows while repairing the romanization to a concatenated office form.
- Office English/French roleName glosses (CBDB, Huckbot5000, MaxiRicci7000) are written onto entity cards on mint and on refresh. CBDB’s `[Not Yet Translated]` placeholder no longer blocks Huckbot fill, and is never stored as a translation.
- Place+suffix office titles (太守/刺史/令, e.g. 豫章太守 → "Commandery Governor of Yuzhang") that neither pack covers now get a live procedural gloss in-app — same template Huckbot5000 uses offline, applied on tag, disambiguate, lookup, and bulk backfill. French gets a matching naive template (no offline precedent for this pattern yet). Tagged `Huckbot5000 (procedural)` / `MaxiRicci7000 (procedural)` in `entity_translations` so it's distinguishable from pack-sourced glosses; still declines institutional/prefixed/dynasty-glued names rather than inventing a place.
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
- Vernacular glosses automatically generated upon creation of new entities matching governer/commandant/district chief pattern.
- First-occurrence titles can lead with the vernacular gloss instead of the romanization (`Livre des Jin (Jinshu 晉書)`): per-mention toggle on the entity-display popup, plus a personal per-language default in Translation policy settings. Work italics follow the leading title.
- Missing translations get a dashed “add translation…” nudge in the entity editor (one chip per configured project language) and in the entity-display popup (for the active pane language). Neither inserts placeholder text into the document.
- On those nudge surfaces, “Suggest with AI” can fill the draft gloss for review; the user still saves or adds it. Never auto-writes to the entity store.
- The Database Window's bulk Wikidata refresh now pulls work titles for every language configured in Translation policy settings, not just English plus the desktop UI language. Also fixed: that refresh wasn't passing the desktop UI language at all, so in practice it only ever fetched English titles.
- Office entities can now carry a date range (same date form as works, now offered for offices too), and the auto-tagging disambiguation panel shows each candidate's date range or dynasty when picking between period-specific offices — e.g. distinguishing two entities sharing a title but from different eras. Nothing to render or configure otherwise: which office you tag is which translation you get.
- Offices with a vernacular gloss now default to that gloss alone in the translation pane (no pinyin or characters); the display popup can still re-enable extras. Office gloss lookup falls back between en and fr when one language is missing.
- CBDB (and similar) person dates are no longer lumped together: real floruit earliest/latest (`dateSource: floruit`) is kept as floruit — stored on a `dates` row with precision `fl.`, shown as `fl. A–B` in Disambiguate, entity display, and the sidebar; the person date editor’s `fl.` mode takes a From/To range and writes that row (clearing birth/death so the two do not fight). CBDB index/mean years stay filter-only for the Disambiguate date slider (±30) and are never shown or minted as `fl.`; old pack clues that mislabeled an index year as `fl. YEAR` are scrubbed on load. Pack clue generation restores real floruit and omits index years (recompile packs when convenient for clean NDJSON at source).

### UI and settings

- Fixed a ghost **Delete entity (1)** state in the database panel when jumping to an entity that is not yet linked to the central database: the panel no longer selects the corpus `@key` while browsing central rows (which use different ids), so the delete button no longer lights up with nothing visibly checked.
- Find: active hit now also marks the containing editor line with thick red vertical bars (in addition to orange inline highlight), so matches stay visible when entity/tag highlighting competes on the same row.
- Settings → AI API: **Placeholder retry limit** (0–5, default 1) for AI translation when the model drops required entity/date placeholders.
- Settings panel overhaul.
- Removed legacy popups ('Hey, looks like you're copying... Do you want to learn about copying?').
- Removed legacy help pop-ups.
- F5 now refreshes whichever panel(s) support it — translation pane entity anchors, file explorer tree, and database viewer entities — instead of only being wired one place at a time. File explorer also got a standalone refresh button.
- CSS panel now uses the updated highlighter tab icon instead of the placeholder marker-pen SVG.
- Fixed the Database Window pill reading "Fenêtre base de données" (window base de données) in French — now just "Base de données".
- Fixed the AI API "Connected. Found N model(s)" message (and a few tag-bomb queue messages) rendering literal `{{...}}` template syntax instead of a proper plural — was using an inline ICU plural pattern this app's i18next setup doesn't support; converted to standard singular/plural translation keys.

### Rewards system

- Merit of Persistence (**File saves**) now counts every successful save (`saveCount`), not only distinct file paths — re-saving the same document advances the ladder. Rapid saves are serialised so concurrent Ctrl+S cannot drop counts, and a tag-stats failure no longer skips the achievements pass.
- Ribbon (per-metric class) unlock snackbars now say the classe (e.g. Vème classe, Ordre du Chevron) instead of the overall rank name (e.g. Sergent) — ranks stay for commission; classes are what each ladder awards.
- Medal unlock toasts are held until you save a portrait in Service Record; medals still unlock and persist in the background, and waiting notifications are delivered after the first portrait save.
