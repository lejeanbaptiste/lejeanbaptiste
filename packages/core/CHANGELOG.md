## 1.5.0

### Major

This version brings 2 main features and several minor updates.
These main features are a break, but since we are still in development, it will be just a minor bump.

1. Remove the necessity for a proxy to load external resource due to CORS issues
2. Simplify lookups configuration

### Features

#### [43132f4ce3b961330f0b061b95b10f8698640e0a] Load schemas [break]

LEAF-Writer will do its best to load the document's schema and CSS from an external URL. However, some external resources can be blocked by CORS. For instance, `tei-c.org` does not allow external connections, so LEAF-Writer cannot load schemas from this domain. The request could also fail due to error 400-500 or loss of internet connection.
We add alternative URLs to remediate this situation. LEAF-Writer will first try to load the schema declared in the document. If it fails, it will try alternative sources listed under each supported schema.
For example, a TEI-ALL document that points to the following schema: `https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng`
In addition, LEAF-Writer supports the following URLs for a TEI-ALL document: `https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng` and `https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_all.rng`
LEAF-Writer will try to load the document's declared schema first, if it fails it will the alternatives.
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
