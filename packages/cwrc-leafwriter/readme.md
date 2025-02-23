# LEAF-Writer

[![version](https://img.shields.io/npm/v/@cwrc/leafwriter.svg)](https://www.npmjs.com/package/@cwrc/leafwriter)
![NPM](https://img.shields.io/npm/l/@cwrc/leafwriter)
![npm type definitions](https://img.shields.io/npm/types/@cwrc/leafwriter)

![LEAF-Writer Logo](https://leaf-writer.leaf-vre.org/assets/logo/logo-horizontal-small-light.png)

**The XML & RDF online editor of the Linked Editing Academic Framework**

_Partial Documentation - Working in progress_

## Table of Contents

- [LEAF-Writer](#leaf-writer)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Use](#use)
    - [Install](#install)
      - [NPM](#npm)
      - [CDN Direct link](#cdn-direct-link)
    - [Basic Setup](#basic-setup)
      - [Copy necesary files](#copy-necesary-files)
      - [Load main dependencies in the html file](#load-main-dependencies-in-the-html-file)
      - [Instantiate and initialize](#instantiate-and-initialize)
    - [Get current content from the editor](#get-current-content-from-the-editor)
  - [Config Object](#config-object)
    - [Document](#document)
    - [User](#user)
    - [Settings](#settings)
      - [AuthorityService](#authorityservice)
        - [NamedEntityType](#namedentitytype)
        - [AuthorityEntityTypeProps](#authorityentitytypeprops)
        - [AuthoritySearchParms](#authoritysearchparms)
        - [AuthoritySearchLookupResult](#authoritysearchlookupresult)
      - [Schemas](#schemas)
    - [Full Config Example](#full-config-example)
  - [Development](#development)
    - [Localization](#localization)
      - [Add new locale](#add-new-locale)

## Overview

The Linked Editing Academic Framework (LEAF) has developed an in-browser text markup editor (LEAF-Writer, previously known as CWRC-Writer) for use by individual scholars and collaborative scholarly editing projects that require a light-weight online editing environment. This package is the base code that builds the editor as a React component to be embedded in any website.

A default version of the LEAF-Writer powers LEAF-Writer Commons ([https://leaf-writer.leaf-vre.org](https://leaf-writer.leaf-vre.org)), a public and free-to-use enviroment to edit XML documents, tagging named-entities, create Web Annotations, and generate open linked data.

## Use

### Install

LEAF-Writer is developed in JavaScript and is partially typed (work in progress). It is designed as a React component (work in progress), but can be also used in valilla js. It is available on NPM and CDN services.

**Caveat**: Due to LEAF-Writer legacy code, it cannot yet be used as a ES6 module. You will need to copy the necessary files to the public folder on the server and set up the base url if necessary.

#### NPM

```nodejs
npm install @cwrc/leafwriter
```

#### CDN Direct link

`https://unpkg.com/browse/@cwrc/leafwriter@3.0.1/`

### Basic Setup

#### Copy necesary files

Copy the content of `dist` folder to a folder named `leafwriter` in the public folder on the server.

```bash
cp -R ./node_modules/@cwrc/leafwriter/dist/* ./public/leafwriter
```

#### Load main dependencies in the html file

```html
<html>
  <head>
    ...
    <script type="text/javascript" src=“https://unpkg.com/browse/@cwrc/leafwriter/dist/index.min.js”></script>
    <link href="./leafwriter/css/index.css" rel="stylesheet"  type="text/css" />
    ...
  </head>
  <body>
    <script src="./leafwriter/index.min.js"></script>
    ...
  </body>
</html>
```

#### Instantiate and initialize

```ts
import type { Leafwriter } from '@cwrc/leafwriter'; //Add LEAF-Writer types for intellisense

//* This only tells typescript that Leafwriter exists on the global scope (Window) */
declare global {
  interface Window {
    Leafwriter: any;
  }
}

const container = document.getElementById('#leaf-writer');
const editor = new Leafwriter.Leafwriter(container); //it must be an HTML ELEMENT (i.e., a div)

editor.init({
  document: {
    xml: '<xml ...>', // Required (string)},
  },
  settings: {
    //! Important: Tell LW where its dependencies (extra CSS, images, web worker) are located.
    // In the example, we add the files to the folder `leafwriter` in the public folder.
    // The default is '.'
    baseUrl: './leafwriter',
  },
});
```

You must pass a div container to a new LEAF-Writer instance. LEAF-Write will render itself in this container.

Then you initiate it by passing a [Config Object](#config-object). Note: To use LEAF-writer to create Web Annotations, you should pass the user name and URI in the config object.

### Get current content from the editor

Using async/await

```ts
//Assuming the instance is named `editor`

const currentContent = await editor.getContent();
console.log(currentContent);

// Or as a Promise
editor.getContent().then((currentContent) => {
  console.log(currentContent);
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

| Name  | Type     | Default | Description                                                                        |
| ----- | -------- | ------- | ---------------------------------------------------------------------------------- |
| xml\* | `string` |         | (Required) The XML document to be rendered on LEAF-Writer                          |
| url   | `string` |         | The Document's URL. It is used as an IRI on Web Annotations created on LEAF-Writer |

### User

The user object has three properties, exclusively used to assign a creator to Web Annotations created on LEAF-Writer

| Name   | Type     | Default | Description                                                        |
| ------ | -------- | ------- | ------------------------------------------------------------------ |
| name\* | `string` |         | User's name.                                                       |
| uri\*  | `string` |         | (Required) URI pointing to the user info page, profile, or account |
| email  | `string` |         | user's email                                                       |

### Settings

The settings object has three main properties used to set up and customize LEAF-Writer. (more to come).

| Name              | Type                                                      | Default | Description                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| authorityServices | ([`AuthorityService`](#authorityservice) \| `string`)`[]` |         | An list of authority services or their id's seting up the authority services. If you pass a string, it will enable the corresponding authority service. Use the object AuthorityService to fine tune the set up.                                                                                                                                       |
| baseUrl           | `string`                                                  | `.`     | **Important**: By default, LEAF-Writer will load its dependencies (web workers, on-demand modules, extra CSS files) from the root folder. If these files are not on the root, you should define the path to these dependencies here. For instance, set this property to `/path/to/project/addons/` if you put LEAF-Writer dependencies in this folder. |
| locales           | `string`                                                  | `en`    | Localize the UI and the messages. Must be valid and supported language code. E.g., `en`                                                                                                                                                                                                                                                                |
| readonly          | `boolean`                                                 | `false` | Set LEAF-Writer readonly (prevent editing functionalities)                                                                                                                                                                                                                                                                                             |
| schemas           | [`Schema`](#schemas)`[]`                                  |         | An array of schemas to be included as supported by default.                                                                                                                                                                                                                                                                                            |

#### AuthorityService

Configures authorities services used to run entity lookups.
LEAF-Writer includes 6 authority services supporing 5 types of entities:

- [DBPedia](https://www.dbpedia.org): Person, Place, Organization, Work, and Thing.
- [Geonames](https://www.geonames.org/): Place.
- [Getty](https://www.getty.edu/research/tools/vocabularies/): Person and Place.
- [GND](https://www.dnb.de/EN/Professionell/Standardisierung/GND/gnd_node.html): Person, Place, Organization, Work (book), and Thing.
- [LINCS Project](https://lincsproject.ca/): Person, Place, Organization, Work, and Thing.
- [VIAF](https://viaf.org/): Person, Place, Organization, Work (book), and Thing.
- [Wikipedia](https://www.wikidata.org/wiki/Wikidata:Main_Page): Person.

In addition, LEAF-Writer supports a custom authority service that can be used to add new authorities or change the way entities are looked up. There is an example on the packages folder.

Individual users can turn each authority on and off, as well enable and disabled specific entities in each authority depending on their preferences.

All properties are optional, except for the id.

| Name        |                                                                           Type                                                                           | Default |                                                                                        Description                                                                                         |
| ----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------: | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| name\*      |                                                                         `string`                                                                         |         |                                                                                    The authority name.                                                                                     |
| description |                                                                         `string`                                                                         |         |                                                                              A description for the authority.                                                                              |
| url         |                                                                         `string`                                                                         |         |                                                                                   URL to the authority.                                                                                    |
| author      |                                                            { name*: `string`, url: `string` }                                                            |         |                                                                  Author of the code to make authority's lookup function.                                                                   |
| entityTypes |                          [`NamedEntityType`](#namedentitytype)[] \| [`AuthorityEntityTypesProps`](#authorityentitytypeprops)[]                           |         | An array of entity types or an objects with the name and url for each entity type. This object not only defines the entities avialable for the authority, but also where to look for them. |
| search*     | function(params: [`AuthoritySearchParms`](#authoritysearchparms)) = async () => Promise<[`AuthoritySearchLookupResult`](#authoritysearchlookupresult)[]> |         |                                        A function that takes a query and an entityType and returns a promise that resolves to an array of entities.                                        |

##### NamedEntityType

```ts
type NamedEntity = 'person' | 'place' | 'organization' | 'work' | 'thing' | 'concept' |'citation'
```

##### AuthorityEntityTypeProps

| Name  | Type                                  | Default | Description |
| ----- | ------------------------------------- | ------- | ----------- |
| name* | [`NamedEntityType`](#namedentitytype) |         |             |
| url   | `string`                              |         |             |

##### AuthoritySearchParms

| Name       | Type                                  | Default | Description |
| ---------- | ------------------------------------- | ------- | ----------- |
| query*     | `string`                              |         |             |
| entityType | [`NamedEntityType`](#namedentitytype) |         |             |

##### AuthoritySearchLookupResult

| Name        | Type     | Default | Description                       |
| ----------- | -------- | ------- | --------------------------------- |
| label*      | `string` |         | the entity label, usually a name. |
| uri*        | `string` |         | the entity URI.                   |
| description | `string` |         | A description for the entity.     |

#### Schemas

Out-of-the-box, LEAF-Writer supports the following schemas:

- [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng)
- [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng),
- [teiSimplePrint](https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng)
- [jTei](https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_jtei.rng)
- [Orlando](https://cwrc.ca/schemas/orlando_entry.rng)

There are two ways to use LEAF-Writer with other schemas.

1. **On-demand**: By opening a document with an unsupported schema and adding it as a custom schema. This will save the schema information on the Browser's localstorage and it will be available locally as long the user remains logged in.
2. **Permanently**: By passing a list of supported schemas on [LEAF-Writer initialization config](#settings)

The schema object as five properties:

| Name      | Type                                           | Default | Description                                                                                                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id\*      | `string`                                       |         | Unique id                                                                                                                                                                                                                                                                                                               |
| name\*    | `string`                                       |         | A human-readable name to be displayed to the user                                                                                                                                                                                                                                                                       |
| mapping\* | `tei` \| `teiLite` \| `orlando` \| `cwrcEntry` |         | Define how to parse tag names and map schema-specific functionalities. LEAF-Writer supports these four mappings, which are bound to the document's root element (except for teiLite, which is a TEI variation and uses the TEI root element)                                                                            |
| rng\*     | `string[]`                                     |         | A collection of URI pointing to the schema. It must be RNG schemas. LEAF-writer will get the first option unless the connection is not available. In this case, it will try to load the schema from the other options in order. Loading alternative routes to the schema will not change the document definitions.      |
| css\*     | `string[]`                                     |         | Similar to the rng property. A collection of URI pointing to the schema's CSS. LEAF-writer will get the first option unless the connection is not available. In this case, it will try to load the CSS from the other options in order. Loading alternative routes to the CSS will not change the document definitions. |

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
    locale: 'en',
    readonly: false,
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

## Development

### Localization

This project is developed primarily in English and French.
We use localization tools (i18next) to provide transaltion to other languages.

#### Add new locale

To add a new localization, follow these steps:

1. Add new locale file

Duplicate the `.src/locales/en.json` file and rename it according to the ISO 639 [language codes](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes) (two-letter code). For instance, to add Italian, name the file `it.json`

Replace all key values for an empty string `''`.
The system is designed to fallback to English is a key has an empty string.

2. Add support for new locale

on the `./src/i18n.ts`:

```ts
...
// IMPORT NEW LOCAL
import it from './locales/it.json';
...
// ADD RESOURCE.
export const resources = { en, es, fr, pt, de, ro, it } as const;

 // ADD TO THE LIST OF SUPPORTED LOCALES
 // The order here reflect the order in which locales will be displayd in the UI
export const locales = ['en', 'fr', 'es', 'pt', 'de', 'ro', 'it'] as const;
...
```
