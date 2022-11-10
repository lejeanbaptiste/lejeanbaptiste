# LEAF-Writer

![NPM](https://img.shields.io/npm/l/@cwrc/leafwriter)
[![version](https://img.shields.io/npm/v/@cwrc/leafwriter.svg)](https://www.npmjs.com/package/@cwrc/leafwriter)
![npm type definitions](https://img.shields.io/npm/types/@cwrc/leafwriter)

![LEAF-Writer Logo](https://leaf-writer.leaf-vre.org/assets/logo/logo-horizontal-large-light.png)The XML & RDF online editor of the Linked Editing Academic Framework

**Partial Documentation - Working in progress**

## Table of Contents

- [LEAF-Writer](#leaf-writer)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Use](#use)
    - [Install](#install)
    - [NPM and ES6](#npm-and-es6)
    - [In a Browser (UMD compiled version)](#in-a-browser-umd-compiled-version)
      - [Using a CDN-like service](#using-a-cdn-like-service)
      - [Download pre-compiled files from CDN-like service](#download-pre-compiled-files-from-cdn-like-service)
    - [Basic Example](#basic-example)
      - [Instantiate and initialize](#instantiate-and-initialize)
      - [Get current content from the editor](#get-current-content-from-the-editor)
  - [Config Object](#config-object)
    - [Document](#document)
    - [User](#user)
    - [Settings](#settings)
      - [lookups](#lookups)
        - [Lookup Config](#lookup-config)
      - [Schemas](#schemas)
    - [Full Config Example](#full-config-example)

## Overview

The Linked Editing Academic Framework (LEAF) has developed an in-browser text markup editor (LEAF-Writer, previously known as CWRC-Writer) for use by individual scholars and collaborative scholarly editing projects that require a light-weight online editing environment. This package is the base code that builds the editor as a React component to be embedded in any website. A default version of the LEAF-Writer that uses GitHub for storage is available for anyone's use at [https://leaf-writer.leaf-vre.org](https://leaf-writer.leaf-vre.org)

## Use

### Install

### NPM and ES6

```nodejs
npm install @cwrc/leafwriter
```

### In a Browser (UMD compiled version)

If you prefer to load the pre-compiled version directly in the browser you have two options.

#### Using a CDN-like service

Load directly from the web using UNPKG.

```html
<script type="text/javascript" src=“https://unpkg.com/browse/@cwrc/leafwriter/dist/index.min.js”></script> 

<link rel="stylesheet" type="text/css" href=“https://unpkg.com/browse/@cwrc/leafwriter/dist/css/index.css”>
<link rel="stylesheet" type="text/css" href=“https://unpkg.com/browse/@cwrc/leafwriter/dist/css/editor.css”>
```

#### Download pre-compiled files from CDN-like service

Download from the web using JSDELIVER: [https://www.jsdelivr.com/package/npm/@cwrc/leafwriter](https://www.jsdelivr.com/package/npm/@cwrc/leafwriter)

Copy the `dist` somewhere in your project tree. And load files:

```html
<script type="text/javascript" src=“path/to/leafwriter/dist/index.min.js”></script> 

<link rel="stylesheet" type="text/css" href=“path/to/leafwriter/dist/css/index.css”>
<link rel="stylesheet" type="text/css" href=“path/to/leafwriter/dist/css/editor.css”>
```

### Basic Example

#### Instantiate and initialize

```ts
import Leafwriter from '@cwrc/leafwriter';

const container = document.getElementById('#leaf-writer');
const editor = new Leafwriter.Leafwriter(container); //it must be an HTML ELEMENT (i.e., a div) 

editor.init({
  document: {
    xml: '<xml ...>' // Required (string)},
  }, 
  settings: {
    baseUrl: 'path/to/leafwriter/files/', // Optional. Only if LEAF-Writer dependencies are not in the root. Default: '.' 
  },
});
```

You must pass a div container to a new LEAF-Writer instance. LEAF-Write will render itself in this container.

Then you initiate it by passing a [Config Object](#config-object). Note: To use LEAF-writer to create Web Annotations, you should pass the user name and URI in the config object.

#### Get current content from the editor

Using async/await

```ts
//Assuming the instance is named `editor`

const currentContent = await editor.getContent();
console.log(currentContent)

// Or as a Promise
editor.getContent().then((currentContent) => {
  console.log(currentContent)
});
```

## Config Object

The config objects takes 4 objects:

- **Document** (Required)
- User (Optional)
- Settings (Optional)
- Preferences (Optional)

### Document

The document object has 2 properties:

| Name | Type | Default  | Description |
| - | - | - | - |
| xml* | string |  | (Required) The XML document to be rendered on LEAF-Writer |
| url  | string |  | The Document's URL. It is used as an IRI on Web Annotations created on LEAF-Writer |

### User

The user object has three properties, exclusively used to assign a creator to Web Annotations created on LEAF-Writer

| Name | Type | Default  | Description |
| - | - | - | - |
| name* | string |  | (Required) |
| uri*  | string |  | (Required) URI pointing to the user info page, profile, or account |
| email  | string |  | user's email |

### Settings

The settings object has three main properties used to set up and customize LEAF-Writer. (more to come).

| Name | Type | Default  | Description |
| - | - | - | - |
| baseUrl | string | `.` | **Important**: By default, LEAF-Writer will load its dependencies (web workers, on-demand modules, extra CSS files) from the root folder. If these files are not on the root, you should define the path to these dependencies here. For instance, set this property to `/path/to/project/addons/` if you put LEAF-Writer dependencies in this folder. |
| lookups  | `ILookupsConfig` |  | An object containing to configure the entity lookups. See [Authorities](#authorities) |
| schemas  | `Schema[]` |  | An array of schemas to be included as supported by default. See more about Schemas [here](#schemas).  |


#### lookups

An object containing a single property `authorities` that configures the entity lookups. You can configure each authority individually when initializing LEAF-Writer by passing an array with either the authority's name (using the default configuration) or a tuple containing the authority's name and the [Lookup Config](#lookup-config) (see bellow).

LEAF-Writer includes entity lookups to 6 different authorities in 5 types of entities:

- [DBPedia](https://www.dbpedia.org): Person, Place, Organization, Title (book), and Thing.
- [Geonames](https://www.geonames.org/): Place. **Note**: It is disabled by default because the Geonames endpoint needs authentication.
- [Getty](https://www.getty.edu/research/tools/vocabularies/): Person and Place.
- [LGPN](https://www.lgpn.ox.ac.uk/): Person (Greek names). **Note**: It is disabled by default since it is not frequently used.
- [Wikipedia](https://www.wikidata.org/wiki/Wikidata:Main_Page): Person.
- [VIAF](https://viaf.org/): Person, Place, Organization, Title (book), and Thing.

Example

```ts
{
  authorities: [
    'authorityName'
    ['authoritysName', AuthorityConfigObject]
  ]
}
```

##### Lookup Config

| Name | Type | Default  | Description |
| - | - | - | - |
| enabled | boolean |  | Enable / Disable Authority. Note: the user can manually enable the authority in the settings panel. |
| entities  | \[ `person \| place \| organization \| title \| thing` , boolean][] |  | An array of tuples containing the Entity Name and a boolean. Enable / Disable a specific entity lookup. Note: the user can manually enable the entity in the settings panel. |
| config  | Object: { username: string } |  | An arbitrary object with a username property. Used to pass a username to Geonames |

Example:

Let’s say you want to enable LGPN and Geonames, disable Getty, and disable lookups for organization, title, and thing on Wikipedia.

```ts
[
  ['lgpn'],
  ['geonames',
    { config: { username: geonamesUsername } }
  ],
  ['wikidata',
    { entities: [['organization', false], ['title', false] ['thing', false]]}
  ]
]
```

#### Schemas

Out-of-the-box, LEAF-Writer supports the following schemas: 

- [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng)
- [TEI Corpus](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_corpus.rng)
- [TEI Drama](https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_drama.rng)
- [TEI Manuscript](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_ms.rng)
- [TEI Speech](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_speech.rng)
- [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng),
- [Orlando](https://cwrc.ca/schemas/orlando_entry.rng)

There are two ways to use LEAF-Writer with other schemas.

1. **On-demand**: By opening a document with an unsupported schema and adding it as a custom schema. This will save the schema information on the Browser's localstorage and it will be available locally as long the user remains logged in.
2. **Permanently**: By passing a list of supported schemas on [LEAF-Writer initialization config](#settings)

The schema object as five properties:

| Name | Type | Default  | Description |
| - | - | - | - |
| id* | string |  | Unique id |
| name*  | `ILookupsConfig` |  | A human-readable name to be displayed to the user |
| mapping*  | string: `tei \| teiLite \| orlando \| cwrcEntry` |  | Define how to parse tag names and map schema-specific functionalities. LEAF-Writer supports these four mappings, which are bound to the document's root element (except for teiLite, which is a TEI variation and uses the TEI root element) |
| rng*  | `string[]` |  | A collection of URI pointing to the schema. It must be RNG schemas. LEAF-writer will get the first option unless the connection is not available. In this case, it will try to load the schema from the other options in order. Loading alternative routes to the schema will not change the document definitions. |
| css*  | `string[]` |  | Similar to the rng property. A collection of URI pointing to the schema's CSS. LEAF-writer will get the first option unless the connection is not available. In this case, it will try to load the CSS from the other options in order. Loading alternative routes to the CSS will not change the document definitions. |

Example:

```ts
{
  id: 'cwrcTeiLite',
  name: 'CWRC TEI Lite',
  mapping: 'tei',
  rng: [
    'https://cwrc.ca/schemas/cwrc_tei_lite.rng',
    'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/cwrc_tei_lite.rng',
  ],
  css: [
    'https://cwrc.ca/templates/css/tei.css',
    'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/tei.css',
  ],
},
```

### Full Config Example

```ts
import Leafwriter from '@cwrc/leafwriter';

const container = document.getElementById('#leaf-writer');
const editor = new Leafwriter.Leafwriter(container);

editor.init({
  document: {
    xml: '<xml ...>',
    url: 'https://...',
  },
  user: {
    name: 'FirstName lastNamez, 
    uri: 'https://...',
  }
  settings: {
    baseUrl: 'path/to/leafwriter/files/',
    lookups: {
      authorities: [
        ['lgpn'],
        ['geonames',
          { config: { username: 'geonamesUsername' } }
        ],
        ['wikidata',
          { entities: [['organization', false], ['title', false] ['thing', false]]}
        ]
      ],
    },
    schemas: [{
      id: 'cwrcTeiLite',
      name: 'CWRC TEI Lite',
      mapping: 'tei',
      rng: [
        'https://cwrc.ca/schemas/cwrc_tei_lite.rng',
        'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/cwrc_tei_lite.rng',
      ],
      css: [
        'https://cwrc.ca/templates/css/tei.css',
        'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/tei.css',
      ],
    }]
  },
  
});
```