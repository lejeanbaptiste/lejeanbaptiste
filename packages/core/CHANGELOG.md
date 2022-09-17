## 1.8.0

### Features

### Better schema processing and UX for not supported schemas

Rework the logic of check, loading, and processing document schemas. The system is more strict and comprehensive now.

#### 1. Check root element

It will fail on any document wihout a suported root element:

- For TEI: `TEI`, `teiCorpus`
- For TEILite: : `TEI`, `teiCorpus`
- For Orlando: `ENTRY`, `EVENT`, `BIOGRAPHY`, `WRITING`
- For CWRCEntry: `CWRC`

#### 2. Check if the document has a schema attached to its metatag

If it does not, the system will promt the user to select a supported schema or add a custom one.
The document's root element is used to determine the mappings.

#### 3. Check if the schema is supported

If it is not, the system will promt the user to select a supported schema or add a custom one.
The document's root element is used to determine the mappings.

#### 4. Check if the schema loads

If it does not, the system will promt the user to select a supported schema or add a custom one.
The document's root element is used to determine the mappings.

### Add/edit/remove custom schemas on localstorage

Much improved system to add, edit, and remove custom schemas. Custom schemas now persists on the browser's localStorage, making it more convient for peope working on non-soported schemas. Custom scheams needs a name, the schema url, and optional (but recommended) CSS URL. The document's root element is used to determine the mappings.

### New dialog box

Started the transition of Messages and Confirmation Dialog Box to React. Introduce new Dialog Box manager, new designs and UX. Implemented on:

- Load schema process
- Editor mode
- Annotation mode
- Schema change

### 4. Close Event

`onClose` event allows the parent holding LEAF-Writer to react when the editor is about to close.

### Minor Changes

- Validador: Add validation feedback in the bottom bar [66ee06f2746b829f64a823427ee0727bea169cbd]
- Better handling non suported schemas, add custom schema, new dialog boxes, onClose event [f10426f84b954161bade42f4105bd05a5d1823ea]
  - Includes:
    - Split Dialogs from Components on file tree
    - Add types
    - Localization

### Patch

- Tag person: Alphabetize list of roles [1085f1ee0b87cdf8a4dae9a3f98740ffd023e237]
- Fix typo in a dialog box message [a1a9e72b621f588a3b80ceca83df485570a58d4b]
- Context menu: improve header hightlight [d9771768d4691e36ff96402804e99911a1e56806]
- Warning before close tab/window if dcoument has changes [f5de1b40c35a104ff04d130c59702a34416c89e1]
- localStorage: improve api to ge from / set to localStorage [26a29af3cfd797562dab1a4efe7d497ca8a84462]
- Theme: Tweak colour on dark mode [2800bf6f10edea5ff28444b7d8e1dd52b40351d3]
- Schemas: Reorder list [57b851b64057c041dfc9b83e2836feb8406b8a15]
- Types: Fix type source on package.json [d653f15247d5e6f560c2a5806a7885147603077d]
- eslint: add plugin to lint typescript [82521ec420b43585187157292a3e9f9a52749197]
- i18n: tweak configure and add scope (namespace) [c456a509c5a3bdc32ff43a891036f70a3ad6a28d]
- Editor mode: rename options [e919bd2937ea40fa1f6047b178d0c7873366205a]
- Update Dependencies [d60a2b7eb487387f0e394d792cce23e89e986f5d]
  - core:
    - add:
      - mui-modal-provider@2.1.0
    - upgrade:
      - uuid@9.0.0
    - update:
      - @fortawesome/fontawesome-free@6.2.0
      - @mui/icons-material@5.10.3
      - framer-motion@7.3.5
      - prismjs@1.29.0
      - react-router-dom@6.4.0
    - bump up:
      - @emotion/react@11.10.4
      - @emotion/styled@11.10.4
      - @mui/lab@5.0.0-alpha.99
      - @mui/material@5.10.5
      - i18next@21.91.1
      - jquery@3.6.1
      - luxon@3.0.3
      - overmind@28.0.2
      - overmind-react@29.0.2
      - rdflib@2.2.20
      - react-i18next@11.18.6
      - wikidata-sdk@8.0.3
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.37.0
      - @typescript-eslint/parser@5.37.0
      - esbuild-loader@2.20.0
      - eslint-plugin-react@7.31.8
    - bump up:
      - @types/luxon@3.0.1
      - @types/node@18.7.18
- Updated dependencies
  - @cwrc/leafwriter-validator@1.2.0

## 1.7.0
### Minor Changes

- Add link to the documentation in the ribbon [9121ab1181737f64e223d7a9f8d4713dfdf8dba1]
- Add link to report bugs at the bottom bar [6d6c10654ba1339bb493d09c89a89ae7ec9dd9a5]

### Patch Changes

- Geonames: remove extra `$` signal in the request URL [c9dc8303147e201f6c4a78f8e1fae838e5d3f0f6]
- Getty: remove the proxy server. Call it directly from the browser [14c5236ab401070282df2df1059987e35dc49ed5]

## 1.6.2

### Patch Changes

- New release

## 1.6.1

## Fix

[1a1b40580f5cd1c8ae62a7f089ee58be5abef9b5] Web annotation: re add app version and rename app to 'LEAF-Writer'

## Chore

[59a052cb25abfb2856ea58830c8433ff16f2994c] Organize tinyMCE files

## 1.6.0

### Features

[569c99ae3633b84631c46a50e20eb9acb9227592] Schema: drop support to Moravian schema. **THIS IS A BREAKING CHANGE!!!**

## Fix

[db576550322f22e89814ae0dc0860a6fcdcc8c93] Fullscreen: move modals to a more internal div so htey can be displayed correctly in fullscreen

## Dependencies

[74b9e893d425c95b3331d66e6eccf4d44342818c] Update dependencies

- core
  - update
    - @mui/lab@5.0.0-alpha.92
    - @mui/material@5.9.2
    - framer-motion@6.5.1
    - react@18.2.0
    - react-dom@18.2.0
    - react-i18next@11.18.1
    - react-intersection-observer@9.4.0
  - bump up
    - @dnd-kit/core@6.0.5
    - @dnd-kit/sortable@7.0.1
    - @fortawesome/fontawesome-free@6.1.2
    - i18next@21.8.14
    - iso-639-2@3.0.2
    - jquery-ui@1.13.2
    - rxjs@7.5.6
- dev
  - update
    - @types/node@18.6.1
    - @typescript-eslint/eslint-plugin@5.31.0
    - @typescript-eslint/parser@5.31.0
    - webpack@5.74.0
  - bump up
    - @types/chroma-js@2.1.4
    - @types/react-dom@18.0.6
    - eslint-plugin-react@7.30.1
    - mini-css-extract-plugin@2.6.1

## 1.5.0

### Major

This version brings 2 main features and several minor updates.
These main features are a break, but since we are still in development, it will be just a minor bump.

1. Remove the necessity for a proxy to load external resource due to CORS issues
2. Simplify lookups configuration

### Features

#### [43132f4ce3b961330f0b061b95b10f8698640e0a] Load schemas [break]

LEAF-Writer does its best to load the document's schema and CSS from an external URL. However, some external resources can be blocked by CORS. For instance, `tei-c.org` does not allow external connections, so LEAF-Writer cannot load schemas from this domain. The request could also fail due to error 400-500 or loss of internet connection.

We add alternative URLs to remediate this situation. LEAF-Writer will first try to load the schema declared in the document. If it fails, it will try alternative sources listed under each supported schema.

For example, a TEI-ALL document that points to the following schema:

- `https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng`

In addition, LEAF-Writer supports the following URLs for a TEI-ALL document:

- `https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng`
- `https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_all.rng`

LEAF-Writer will try to load the document's declared schema first, if it fails it will try the alternatives.

**Note:** LEAF-Writer does not change the document's schema declaration. The replacement only impacts on internal LEAF-Writer functions (i.e., tree navigation, validation, tag suggestions, etc).

#### [66438425a1209f6206f4b82a2e59fe1421cbe6c0] Simplify Lookups Configuration [break]

LEAF-Writer has a set of entity lookups setup: `DBPedia`, `Geonames`, `Getty`, `LGPN`, `VIAF`, `Wikidata`. All, but two, are enabled unless it is custom configured. All entity types are enabled by default.

`LGPN` is set OFF by default due to its high specificity (Greek terms only). It can still be enabled in the settings panel.

`Geonames` endpoint requires a username. The username must be provided in the config object in order enable Geonames.

The shape of the config object is the following:

```ts
{
  authorities: Array<
    | Authority
    | [
        Authority,
        {
          config?: {
            username?: string;
          };
          enabled?: boolean;
          entities?: Array<[NamedEntityType, boolean]>;
        }
      ]
  >;
}
```

The `authorities` object can be a mixed array with:

1. The authority's name (above). Just the name is enough to enable a disabled authority (e.g., `LGPN`)
2. OR a tuple containing the authority's name and a config object. Here one can enable/disable an authority completely, or enable/disable specific entity types (`person`, `place`, `organization`, `title`, `thing`). One can also pass a config object with the username (e.g., Geonames)

We also removed mentions to `CWRC` and `NSSI` authorities. Instead of these two, we will provide access to the `LINCS` authority as soon as it goes live. [369bd4956e9b54ad56ff2d7a6d0b68a0b7c687eb]

### Fix

[ae03f777904f61fe222d8c3b497a58ba288066d4] Tweak LEAF-writer exit

[ed9bfb435d17f9ef0bd42eba123df54c6d4ad56a] Contextmenu: tweak the position from where context menu popup

[a2c99438178dac8c5b4fb2e6d07a6389d1c1bb88] Fullscreen: Change the fullscreen container

[41c59add878bf857ea6ceac2b7f3ff16515616a2] schemas: update epidoc rng source url to https

[5e0e0a4bc46b5cdea1a74848442b1865fdcd0b9b] config: remove mentions to nerveUrl. Make optional baseUrl and proxy loader

[523cdd3d85788ff1785daf2198f3db02ce977980] Entity list: fix content overflow and action button's color

[4cde50006fe5f8f5bdca4b7a62071d9e05f79440] image viewer: add prefix to css classes to avoid external collision

### Types

[91b6a9822695b6f3985d57a4631b88f7d27128fb] Types: add missing types

### Dependencies

[f6cc1a5698eb957952f7031d9b19a2781321bf93] dev: upgrade: @types/luxon@3.0.0

[56796149fc00d025ca59c6b76ac28b6d2f60272f] core: upgrade luxon@3.0.1

### Docs

[cf7d82b27f690f9327c72b187258b17c865ef2f1] tweak inline documentation

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
