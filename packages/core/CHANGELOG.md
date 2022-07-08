## 1.2.0

## 1.4.2

### Patch Changes

- Scrape Candidate Entities: convert map to array

## 1.4.1

### Patch Changes

- [fix]

  - [Settings Panel] Adjust lookups spacing and overall look
  - [Settings Panel] Improve header. Add close button.
  - [Status / bottom bar] Remove box shadow for better external integration
  - [General] Manage main container. Auto-defines the container height if not pre-defined

  [chore]

  - [webpack] Rename less parent Id to create a scope for leafwriter less generated css
  - [webpack] Unset publicPath. We can later use gloval var `webpack_public_path` to dynamically set the path where the files will be located. This is usuful for external integration where we don't know here the files will be placed.
  - [package] Expose both ts (for impor) and js (for require) on package.json

## 1.4.0

### Minor Changes

- changes how LEAF-Writer configures itself, specifically the path to dep files and proxies

## 1.3.0

### Minor Changes

- 2a97acf: Allows to open the settings dialog from outside LEAF-Writer

## 1.2.1

### Patch Changes

- 5c31be0: Build: fix tinymce css path

### Minor Changes

[0e565de]

- [feat] Add a log manager to improve dev/prod versions
  - We use loglevel to control when to output logs (no more dirty logs on production version).

[1e4b13b]

- **Leaf-write as a instanciable class**
  - Create a new instance passing the content and config.
  - Expose several apis to retrive the content and control the editor through the instance.
  - Handle onload / onchange events
- [Top Bar] Remove topbar and move settings to a dialog
  - The previous topbar functionalities are not a specific concern to Leaf-writer.
  - The client must implements load/save funcioalinities, as well as auth and storage.
  - The seetings panel is now a dialog that is accessible through the editor ribbon.
- [Entity lookups] Better error handling
- [Editor] Fix bug preventing toggle shwow tags
- [Theme] Entities are optional to avoid propagation to leaf-writer commons
- [Contentmenu] Simplify skeleton size
- [Perf] Add types
- [Chore] Rename folder @types to types
- [Chore] Format with prettier and remove empty lines
- [Dependencies] Update

### Patch Changes

[924a08a]

- **Update to Reac 18**
  - Update dependencies
