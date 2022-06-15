---
'@cwrc/leafwriter-commons': minor
'@cwrc/leafwriter': minor
'@cwrc/leafwriter-storage-service': minor
---

### `@cwrc/leafwriter`

- **Leaf-write as a instanciable class**
  - Create a new instance passing the content and config. Expose several
apis to retrive the content and control the editor through the instance. Handle onload / onchange events
- [Top Bar] Remove topbar and move settings to a dialog
  - The previous topbar functionalities are not a specific concern to
Leaf-writer. THe client must implements load/save funcioalinities, as
well as auth and storage. The seetings panel is now a dialog that is
accessible through the editor ribbon.
- [Entity lookups] better error handling
- [Editor] fix bug preventing toggle shwow tags
- [Theme] entities are optional to avoid propagation to leaf-writer commons
- [Contentmenu] simplify skeleton size
- [Perf] Add types
- [Chore] Rename folder @types to types
- [Chore]  Format with prettier and remove empty lines
- [Dependencies] update

### `@cwrc/leafwriter-storage-service`

- [UX] Replace message dialog for alert dialog to improve UX
  - Message dialog still exists but it is used only when the user need to do
some action like delete a file.
- [Progress] Replace linear for circular progress bar while loading the UI
- [Perf] Simplify code logic
- [Chore] Rename types folder
- [Dependencies] update

### `@cwrc/leafwriter-commons`

- **Leaf-write as a instanciable class**
  - Create a new instance passing the content and config. It requires the content to be edit a set of config options. Track onload/onchange events
- [UX] New top bar
  - Includes load/save funcionalities, keyboard shortcuts, metadata and profile
- [UX] Redesing storage panel and sign section
- [UX] Improve auth state and profile UI
- [UX] Add settings to profile menu
- [UX] New Icons
- [Progress] New loading animation
- [Chore] Split overmind state/actions
- [Chore] Rename folder @types to types
- [Chore] Rename config file
- [Chore] Add prettier to eslint
- [Dependencies] update

### Root

- [dependencies] Update dependencies
