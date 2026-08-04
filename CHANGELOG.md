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

- Welcome splash now includes toggle to activate/disactivate advanced features
- Removed legacy popups ('Hey, looks like you're copying... Do you want to learn about copying?')
- Settings panel overhaul
- Removed legacy help pop-ups
- Editor pane now follows programme's light/dark choice, rather than independantly following the OS.
- Fixed: save timestamp was not putting @version on <application>, causing validation error in Source mode. 
- Serialised boots to avoid TinyMCE load race that leaves LJB without an editor pane.
- Simplified slideshow of loading screens on startup.
- Have Monaco auto insert appropriate closing tag on `</`
- Added LanguageTool spelling and grammar correction to the translation panel.