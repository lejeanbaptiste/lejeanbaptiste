# LEAF-Writer Validator

![NPM](https://img.shields.io/npm/l/@cwrc/leafwriter-validator)
[![version](https://img.shields.io/npm/v/@cwrc/leafwriter-validator.svg)](https://www.npmjs.com/package/@cwrc/leafwriter-validator)
![npm type definitions](https://img.shields.io/npm/types/@cwrc/leafwriter-validator)

LEAF-Writer Validator is a web worker able to validate XML documents stored in DOM trees according to a Relax NG schema. It is a fully typed wrapper around [Salve (Schema-Aware Library for Validation and Edition)](https://github.com/mangalam-research/salve) and [salve-dom](https://github.com/mangalam-research/salve-dom), which are de facto the library that validates XML documents. Please refer to their respective documentation for information about how these two libraries work.

Given an XML document and its Relax NG schema, LEAF-Writer Validator can perform validation, retrieve information about errors (including documentation, if available), get information about elements defined in the schema (tags, attributes values), list possible attributes and children elements for a tag, and speculative validate insertion of tags in a specific context (before, after, inside, or around a tag) to assist the user in editing the document.

As a web worker, LEAF-Writer Validator is fast and non-blocking. Validation will occur in parallel to the browser’s main thread. However, depending on the schema's complexity and the document's length, the validation processes (including all the features listed above) might take some time to respond. When simply validating the document, the web worker emits events as it goes through the document. These events can be used to keep the UI updated. Other features, such as speculative validates insertion of a tag in a specific context, are asynchronous, and they will only return at the end of the process.

- [Install](#install)
- [Load as a web worker](#load-as-a-web-worker)
- [Validation](#validation)
  - [Initialize](#initialize)
  - [Validate](#validate)
- [Get information from Schema](#get-information-from-schema)
  - [Get Tag at](#get-tag-at)
  - [Get Elements for a Tag at](#get-elements-for-a-tag-at)
  - [Get Attributes for a Tag at](#get-attributes-for-a-tag-at)
  - [Get Tag Attribute at](#get-tag-attribute-at)
  - [Get Tag Attribute value at](#get-tag-attribute-value-at)
- [Get Valid Tags At](#get-valid-tags-at)
- [Reset](#reset)
- [Types](#types)
- [Development](#development)

## Install

To install as a dependency, simply type
`npm install @cwrc/leafwriter-validator`

LEAF-Writer Validator uses [comlink](https://github.com/GoogleChromeLabs/comlink) as peer-dependency to facilitate communication to and from web workers. So, we should install it as well.
`npm install comlink`

## Load as a web worker

There are two always to incorporate LEAF-Writer Validator.

### Prebuilt

The first method uses a prebuilt bundled minified version `leafwriter-validator.worker.js` found in the `dist` folder.

1. Copy leafwriter-validator.worker.js to the root of the website public folder.
2. Import Comlink and LEAF-Writer Validator type
3. Load Web worker from the root of the public folder

```ts
import type { Validator } from '@cwrc/leafwriter-validator';
import * as Comlink from 'comlink';

const worker = await new Worker('leafwriter-validator.worker.js');
const validator:Comlink.Remote<Validator> = Comlink.wrap(worker);
```

### For development

The second method is more suitable for development. In this case, we should be imported directly from the node_modules dependency. [Webpack](https://webpack.js.org) will take care of splitting the file into a web worker.

1. Import Comlink and LEAF-Writer Validator type
2. Load Web worker from the `@cwrc/leafwriter-validator`

```ts
import type { Validator } from '@cwrc/leafwriter-validator';
import * as Comlink from 'comlink';

const worker = await new Worker(new URL('@cwrc/leafwriter-validator', import.meta.url))
const validator: Comlink.Remote<Validator> = Comlink.wrap(worker);
```

## Validation

### Initialize

Once imported, the first thing we should do is initialize the validator by loading the schema into the validator. LEAF-Writer Validator can handle this in two ways: **load from URL** or **load from cache**.

#### From URL

To load a schema from a URL, we should call the method `initialize` passing an object ([InitializeOptions](#initializeoptions)) with the `URL` from which LEAF-Writer Validator can download a Relax NG schema in XML and the `id` (string) to identify the schema. We use the id to avoid reloading the same schema if the method is called with the same parameters.

This is an asynchronous function because LEAF-Writer Validator has to download and convert the schema to salve's internal format (more about how Salve converts schemas [here](https://github.com/mangalam-research/salve#converting-schemas)). Besides converting the schema, Salve can export a JSON version to be cached and a manifest with a hash that can be used to check if the file got updated and should be reprocessed. Because the JSON version can result in a very large object (+1.5MB), LEAF-Writer Validator goes one step further and uses [LZUTF8](https://github.com/rotemdan/lzutf8.js) to compress it.

`initialize` returns an object ([InitializeResponse](#initializeresponse)) with two properties: `status` (a simple status message), and  `parsedSchema` (another object) containing the `manifest and` the compressed `json` version of the schema. We can store `parsedScheama` on the browser's local storage to speed up subsequent calls to this method.

Example:

```ts
const response = await validator.loadSchema({
  id:'cwrcTeiLite',
  url: 'https://cwrc.ca/schemas/cwrc_tei_lite.rng'
});

const { status, parsedSchema } = response;
console.log(status); //'Loaded from file'
```

#### From Cache

Instead of loading from an URL, we can load the schema passing the parsed schema we have stored on the Local Storage. We should call the method `initialize` passing an object ([InitializeOptions](#initializeoptions)) with the `id` and `cachedSchema` with stringified `parsedSchema`. It returns an object ([InitializeResponse](#initializeresponse)) with just the `status` message.

Example:

```ts
const parsedSchema  = localstorage.get('schema');

const response = await validator.loadSchema({
  id:'cwrcTeiLite',
  cachedSchema: JSON.stringfy(parsedSchema)
});

const { status } = response;
console.log(status); //'Loaded from cache'
```

Note: Communication between the main thread and web workers is made through message exchanging (strings). We should use `JSON.stringfy` and `JSON.parse` to send data to and from web workers. **Comlink** takes care of this task for us, making it easier to manage data transfers.

### Validate

With the schema loaded, we can now send the document into LEAF-Writer Validator, calling the method `validate`, passing the `XML document` as a string and a `callback`. We can call this method at any time after the schema is loaded. The validation process dispatches `state-update` events that trigger a callback function as the validator walks through the document. This callback will give us updates and let us know when the process is completed.

**Parameters**

| Name | Type | Description |
|--|--|--|
| XML document* | string | The XML document |
| callback | func | A function to receive event updates and the final results.<br/> Signature: `(workingStateData: WorkingStateData) => void`. See more about [WorkingStateData](#workingstatedata). |

Example:

```ts
const documentString = new XMLSerializer(XMLDocument);

validator.validate(documentString,(event) => {
  if (event.state === 1 || event.state === 2) {
    console.log(event.partDone * 100) // 22% (assuming partDone === 0.2)
  }

  if (event.state === 4) {
    console.log(event.valid) // true
  }
  
  if (event.state === 3) {
    console.log(event.valid) // false
    event.errors.forEach((error) => console.log(error)) //the list of errors
  }
});
```

While the state is **[1] INCOMPLETE** or **[2] WORKING**, the [WorkingStateData](#workingstatedata) only returns `{ partDone, state }`, which can be used to show a progress bar expressed in percentage.

if the state returns **[3] INVALID** the [WorkingStateData](#workingstatedata) returns the full object `{ errors, partDone, state, valid }`, valid is **false**. This is the last time the callback will be triggered since the validator has completed the process. Error are object type [ValidationError](ValidationError).

if the state returns **[4] VALID** the [WorkingStateData](#workingstatedata) only returns `{ partDone, state, valid }`, where valid is **true**. This is the last time the callback will be triggered since the validator has completed the process.

#### On Demand vs. Auto-validation

We can call `validate` **on demand**, that is, every time a user clicks on a button, or **auto validate** every time the document changes (recommended). Auto-validation is helpful because the web worker is not synchronized with the XML in the DOM. Auto-validation is a valuable feature and keeps the document updated on the web worker.

**This is important** because when we have to get information about a tag or an attribute or get possible validated children for a tag, the validator needs to have the most updated version of the document already validated to be able to get perform the task. Otherwise, every time we want to do this task, we would have to pass the entire document and wait for validation before getting the results.

Auto-validation does not prevent on-demand validation. We added a validate button to the LEAF-Writer interface to improve usability to allow users to trigger the actions themselves. We also trigger `validate` before saving the document to warn users of potential mistakes.

#### Types of errors

Salve can handle several different validation errors (See [here](https://github.com/mangalam-research/salve/blob/develop/lib/salve/errors.ts)). The most important in our context are `ElementNameError`, `AttributeNameError`, `AttributeValueError`, `ChoiceError`, `ValidationError`. On LEAF-Writer Validator, these errors are sent to the main thread as an array of objects ([ValidationError](#validationerror)) with derails about where the error occurs and documentation, if available.

##### Element Name

An Element Name Error occurs when a (parent) tag contains a child element that is not allowed or not defined in the schema. For instance, the document contains `<div><sunny>In the park</sunny></div>` but the tag `<div>` cannot have `<sunny>` as a child. In this case, `<sunny>` is the target, and `<div>` is the element.

We can use `{error.element.xpath}` to inform, highlight, and navigate directly to the location where the error occurs in the document. If available, we can also display the element's documentation `{error.element.documentation}` and full name `{error.element.fullname}`. If the target is defined in the schema, so it might have some documentation `{error.target.documentation}` and a fullname `{error.target.fullname}` as well.

##### Attribute Name

An Attribute Name Error occurs when a tag contains any attribute not defined in the schema. For instance, the document contains `<closer day=“22">`, but the element `<closer>` on the schema does not contain the attribute `day`. In this case, `<closer>` is the `element`, and `day` is the `target`.

We can use `{error.element.xpath}` to inform, highlight, and navigate directly to the location where the error occurs in the document. If available, we can also display the element's documentation `{error.element.documentation}` and full name `{error.element.fullname}`. If the target is defined in the schema, so it might have some documentation `{error.target.documentation}` and a fullname `{error.target.fullname}` as well.

##### Attribute Value

An Attribute Value Error occurs when a tag contains an attribute that has a value outside the range defined in the schema. For instance, the document contains `<persName cert="none">` but the attribute `cert` [certainty] of element `<persName>` [personal name] cannot have `none` as a value. In this case, `cert` is the target, and `<persName>` is the element.

We can use `{error.element.xpath}` to inform, highlight, and navigate directly to the location where the error occurs in the document. If available, we can also display the element's documentation `{error.element.documentation}` and full name `{error.element.fullname}`. The same can be done to the attribute. If available, we can also display documentation `{error.target.documentation}` and full name `{error.target.fullname}`.

##### Choice Error

##### Validation Error

#### Has validator

LEAF-Writer Validator has a handy function to check if the validator is initialized. The validator needs a schema and a document. So, calling `hasValidator` without one or the other will return `false`. Otherwise, this function returns `true`. Use this function before triggering any method to check if the task can be done.

```ts
const hasValidator = await validator.hasValidator();
console.log(status); // true or false
```

## Get information from Schema

We can use the validator to get detailed information about a tag or an attribute defined in the schema. We can use these methods to expand errors details with documentation and to get information about elements at any time. It is helppful to populate possible children for a tag or attribute.

### Get Tag at

Get the element definition using xpath. Call `getTagAt` passing `tagName`, `parentXpath` and `index` . The validator will look for the `tagName` at the possible elemens on the tags's `parentXpath` and `index`. It return an object [ElementDetail](#elementdetail) with the element type (`tag`), the tag `name`, `documentation` [if available], `fullName` [extracted from documentation, if available], and `ns` [namespace if available]

**Parameters**

| Name | Type | Description |
|--|--|--|
| tagName* | string | The tag name |
| parentXpath* | string | The tag's parent Xpath |
| index | number | The index position relative to its parent. Default is `0` |

Example:

```ts
const tag = await validator.getTagAt('p', 'TEI/text/body/div');

console.log(tag);
/*
{
  type: 'tag',
  name:'p',
  ns: 'http://www.tei-c.org/ns/1.0',
  documentation: '(paragraph) marks paragraphs in prose. [3.1. 7.2.5. ]',
  fullName: 'Paragraph',
}
*/
```

### Get Elements for a Tag at

Get a list of element for a tag using xpath. Call `getElementsForTagAt` passing `xpath` and `index` . The validator return an array of objects [ElementDetail](#elementdetail) with the element type (`tag`), the tag `name`, `documentation` [if available], `fullName` [extracted from documentation, if available], and `ns` [namespace if available]

**Parameters**

| Name | Type | Description |
|--|--|--|
| xpath* | string | The tag's Xpath |
| index | number | The index position relative to its parent. Default is `0` |

Example:

```ts
const tags = await validator.getElementsForTagAt('TEI/text/body/div');

console.log(tags);
/*
[
  {
    type: 'tag',
    name:'p',
    ns: 'http://www.tei-c.org/ns/1.0',
    documentation: '(paragraph) marks paragraphs in prose. [3.1. 7.2.5. ]',
    fullName: 'Paragraph',
  }
  ...
]
*/
```

### Get Attributes for a Tag at

Get a list of attributes for a tag using xpath. Call `getAttributesForTagAt` passing `xpath` and `index` . The validator return an array of objects [ElementDetail](#elementdetail) with the element type (`attribute`), the attribute `name`, `documentation` [if available], `fullName` [extracted from documentation, if available], and `ns` [namespace if available]

**Parameters**

| Name | Type | Description |
|--|--|--|
| xpath* | string | The tag's Xpath |
| index | number | The index position relative to its parent. Default is `1` |

Example:

```ts
const attributes = await validator.getAttributesForTagAt('TEI/text/body/div/p');

console.log(attributes);
/*
[
  {
    type: 'attribute',
    name: 'seg',
    fullName: 'arbitrary segment',
    documentation: `(arbitrary segment) represents any segmentation of text below the chunk level. [16.3.  6.2.  7.2.5. ]`,
    ns: 'http://www.tei-c.org/ns/1.0',
  }
  ...
]
*/
```

### Get Tag Attribute at

Get attribute's details for a tag using xpath. Call `getTagAttributeAt` passing `attributeName` and `parentXpath` . The validator return an object [ElementDetail](#elementdetail) with the element type (`attribute`), the attribute `name`, `documentation` [if available], `fullName` [extracted from documentation, if available], and `ns` [namespace if available]

**Parameters**

| Name | Type | Description |
|--|--|--|
| attributeName* | string | The attribute's name |
| parentXpath* | string | The attribute's parent Xpath (i.e., the tag's xpath) |

Example:

```ts
const attribute = await validator.getTagAttributeAt('seg','TEI/text/body/div/p');

console.log(attribute);
/*
{
  type: 'attribute',
  name: 'seg',
  fullName: 'arbitrary segment',
  documentation: `(arbitrary segment) represents any segmentation of text below the chunk level. [16.3.  6.2.  7.2.5. ]`,
  ns: 'http://www.tei-c.org/ns/1.0',
}
*/
```

### Get Tag Attribute value at

Get a list of possible values for tag's attribute using xpath. Call `getValuesForTagAttributeAt` passing `xpath`. The validator return an array of objects [ElementDetail](#elementdetail) with the element type (`value`), and the value `name`.

**Parameters**

| Name | Type | Description |
|--|--|--|
| xpath* | string | The attribute's Xpath. The last part of the Xpath must start with a `@` sign to define it as an attribute |

Example:

```ts
const attributeValue = await validator.getValuesForTagAttributeAt('/TEI/text/body/div/closer/signed/persName/persName/@cert');

console.log(attributeValue);
/*
[
  { type: 'value', name: 'high' },
  { type: 'value', name: 'medium' },
  { type: 'value', name: 'low' },
]
*/
```

## Get Valid Tags At

We can use the validator to get valid children tags for context. For instance, let's say we want to insert a tag inside an empty `<p>`.

Call the method `getValidTagsAt` passing an object [GetValidTagsAtParameters](#getvalidtagsatparameters). This method will first get all the possible children tags for `<p>` at the exact position on the document (context) and then **virtually** loop through the list, inserting each child inside `<p>` and (speculatively) validates according to the tag context but respecting schema. If the insertion produces an invalid structure, the tag is discarded. The remaining tags are considered validated suggestions.

The method returns the object [GetValidTagsAtResponse](#getvalidtagsatresponse), which inclide the list of possile tags and the list of validated tags.

Example:

```ts
const results = await validator.getValidTagsAt({
  xpath: 'TEI/text/body/div/p',
  index: 0,
  selection: {
    endContainerIndex: 0
    endOffset: 20
    startContainerIndex: 0
    startOffset: 14
    type: "span"
  }
});

console.log(results);
/*
{
  index: 0,
  xpath: 'TEI/text/body/div/p',
  possible: [...],
  speculative: [...]
}
*/

console.log(results.possible.length) // 97
console.log(results.speculative.length) // 75
```

## Reset

Use `reset` to dispose of the validator, schema and the document from the web worker. This is handy when switching between documents with different schemas in the same session.

Example:

```ts
validator.reset()
```

## Types

We use **TypeDoc** to autogenerate documentation from the code.
Run `npm run build-documentation` to get a nice page with all the types.

### ElementDetail

| Name | Type| Description |
|--|--|--|
| type* | `node` \| `tag` \| `attribute` \| `attributeValue` | The type of the element.<br/><br/> `node` is all the possibilites that are not a `tag` , an `attribue` or an `attribute value`. For instance, `end of tag`, and `text` node. |
| name* | string | That name of the element (tag name, attribute name, or atribute value). |
| documentation | string | Documentation (if available). |
| fullName | string | Full name extracted from documentation (if available). || ns | string | The namespace. |

### GetValidTagsAtParameters

| Name | Type | Description |
|--|--|--|
| xpath* | string | The tag Xpath in the document. |
| index* | number | The index position relative to its parent. |
| selection | [GetValidTagsAtParametersSelection](#getvalidtagsatparametersselection) | Omit to consider the exact caret position. Otherwise, pass a `getvalidtagsatparametersselection` object giving more specificity to the request. |
| speculate* | boolean | Enabled/disabled speculative validation. Default is `true` |

### GetValidTagsAtResponse

| Name | Type | Description |
|--|--|--|
| xpath* | string | The tag xpath in the document. |
| index* | number | The index position relative to its parent. |
| possible* | [ElementDetail](#elementdetail)[] | An array of possible tags. |
| speculative* | [ElementDetail](#elementdetail)[] | An array of speculative valid tags. |

### GetValidTagsAtParametersSelection

| Name | Type | Description |
|--|--|--|
| type* | `'span'` \| `'inside'` \| `'around'` \| `'before'` \| `'after'` \| `'change'` | `span`: Use when to add a portion of the document inside a new tag. We must also provide `startContainerIndex`, `startOffset`, `endContainerIndex`, and `endOffset`. <br/><br/> `inside`: Similar to `span`. Use to add a new tag containing all the content of the target tag into the parent tag, as if we would have made a text selection with everything inside the target tag. We must also provide `startContainerIndex`, `endContainerIndex`, and `xpath`. <br/><br/> `around`: Similar to `inside`. Use to add a new tag containing all the content of the target tag (and including the target tag itself) into the parent tag. We must also provide `xpath`. <br/><br/> `before`: Add a new tag before a target and into the parent container. We must also provide `containerIndex` and `xpath`. <br/><br/> `after`: Similar to `before`. Use to add a new tag after a target and into the parent container. We must also provide `containerIndex` and `xpath`. <br/><br/> `change`: Similar to `inside`. Use to change the target tag, preserving the content inside. We must also provide `startContainerIndex`, `endContainerIndex`, `xpath`, and `skip`.|
| startContainerIndex | number | The container index relative to its parent where the selection starts. Used with `span`, `inside`, and `change` |
| startOffset | string | The index position relative to `startContainerIndex` where selection starts. This is where the selection caret starting point. Used with `span` |
| endContainerIndex | string | The container index relative to its parent where the selection ends. Used with `span`, `inside`, and `change` |
| endOffset | number | The index position relative to `endContainerIndex` where selection ends. This is where the selection caret endpoint. Used with `span` |
| skip | string | The name of the tag to skip. Used with `change` to avoid suggesting changing a tag for itself. |
| xpath| string | The tag Xpath in the document. Used with `inside`, `around`, `change`, `before`, and `after` |
| containerIndex | number | The container index relative to the target parent. Used with `before` and `after` |

### InitializeOptions

| Name | Type | Description |
|--|--|--|
| id* | string | Schema identifier |
| url | string | The schema url. Required if `cachedSchema` is omitted |
| cachedSchema | string | A stringfied object. <br/> Signature: `{ json: string; manifest: { filePath: string, hash: string }}` |
| createManifest | boolean | Whether or note to create a manifest. Default is true. |

### InitializeResponse

| Name | Type | Description |
|--|--|--|
| status* | string | The way loader load the schema. One of the following: 'Loaded from file' \| 'Loaded from cache' \| 'Already loaded' |
| parsedSchema | string | A stringfied object. <br/> Signature: `{ json: string; manifest: { filePath: string, hash: string }}` |

### ValidationError

| Name | Type | Description |
|--|--|--|
| type* | `'AttributeNameError'` \| `'AttributeValueError'` \| `'ElementNameError'` \| `'ChoiceError'` \| `'ValidationError'` | The error type.|
| msg* | string | An explanatory message about the error, indicating for instance that an attribute doesn't belong to a tag or a tag cannot be a child of its parent |
| target* | [ValidationErrorTarget](#validationerrortarget) | The invalid element. see bellow |
| element* | [ValidationErrorElement](#validationerrorelement) | The specific parent tag where the error was found. the see bellow |

### ValidationErrorElement

| Name | Type | Description |
|--|--|--|
| xpath* | string | The target Xpath in the document. It can be useful to locate and navigate to the exact error position quickly. |
| name | string | The name of the element (tag or attribute), if defined in the schema. |
| documentation | string | If available in the schema. It can help users understand the context where the error occurred. |
| fullname | string | The full name of the element (tag or attribute), if defined in the document schema. |
| parentElementXpath | string | Expose the parent element Xpath. It gets handy if the error is an attribute. |
| parentElementIndex | number | Expose the parent element index relative to its parent. It gets handy if the error is an attribute. |
| parentElementName | string | Expose the parent element name. It gets handy if the error is an attribute. |

### ValidationErrorTarget

| Name | Type | Description |
|--|--|--|
| xpath* | string | The target’s Xpath in the document. Useful to locate and navigate to the exact error position quickly. |
| index* | number | The index position relative to its parent. |
| isAttr* | boolean | If the error is an attribute. Default is `false`. |
| ns | string | The namespace. |
| name | string | The name of the element (tag or attribute), if defined in the schema. |
| documentation | string | If available in the schema. It can help users understand the context where the error occurred. |
| fullname | string | The full name of the element (tag or attribute), if defined in the document schema. |

### WorkingStateData

| Name | Type | Description |
|--|--|--|
| state* | `1` [INCOMPLETE] \| `2` [WORKING] \| `3` [INVALID] \| `4` [VALID] | The state of the validation process. |
| partDone* | number | The percentage of the document validated (0-1). |
| valid | boolean | Of the document is valid or not. Only available on state `3` and `4`. |
| errors | [ValidationError](#validationerror)[] | An array of errors. Only available on state `3`. |

## Development

I am in debt to [Louis-Dominique Dubeau](https://github.com/lddubeau), who developed Salve and salve-dom at the [Mangalam Research Center for Buddhist Languages](https://github.com/mangalam-research). For any information about [Salve (Schema-Aware Library for Validation and Edition)](https://github.com/mangalam-research/salve)and [salve-dom](https://github.com/mangalam-research/salve-dom), please refer to their documentation.

This project uses a slightly different version of Salve, tweaked by [Raffaele Viglianti](https://github.com/raffazizzi) to add element documentation to Salve's result.

### Why a web worker?

Validating an XML document is CPU-intensive. JavaScript is a single tread language. Depending on the document's size and the schema's complexity, the process can overload the main thread and freeze the page. By transferring the process to a web worker and using events and async/await, we can remove the burden on the main thread and have a more smooth frontend experience.

However, web workers have some limitations. The main limitation is that it does not have access to the DOM, where the XML document is located, nor access to DOM APIs, which salve-dom relies on. This limitation can be overcome by using JSDOM (read more below) to be able to manipulate a virtual DOM on the web worker. The downside is that the size of the web worker file increases substantially, but when minified by Webpack and cached in the browser won't cause a significant impact on the loading time.

Since the DOM cannot be accessed, the document needs to be stringfied and transferred to the web worker to be validated. Moreover, this transfer most occurs every time the document changes to keep both versions in sync, which is essential to support some of the functions on LEAF-Writer (e.g., get tag attributes, speculative validation).

Besides these limitations, using a web worker for validation is better than other solutions we have in the past — an external micro-service based on Java and having the validator in the main thread. We have not run a benchmark test (yet), but we have tested with large files (a whole 2 MB XML book in TEI): validation is done in 1-2 seconds.

#### Changes to Salve and Salve-Dom to be able to work as a web worker

We made minor tweaks to the code to make `Salve` and `salve-dom` work on a web worker environment.

On **Salve**:

- added `globalObject: "this"` to the Webpack's config file [7124f82d](https://gitlab.com/calincs/cwrc/leaf-writer/salve/-/commit/d44f53944b2b51672102920a5a18112aac2a97a4).

on **salve-dom**:

- Added `globalObject: "this"` to the Webpack's config file [0ce55e81](https://gitlab.com/calincs/cwrc/leaf-writer/salve-dom/-/commit/c7f35ae32c2252ebb4ba1382e2c681bd9d9ce253).
- Export the **NODE** object [460d2212](https://gitlab.com/calincs/cwrc/leaf-writer/salve-dom/-/commit/460d2212c2c4ebf814505f00aaad082d9ab49b7f)

#### JSDOM inside web worker

From JSDOM documentation: [https://github.com/jsdom/jsdom#running-jsdom-inside-a-web-browser](https://github.com/jsdom/jsdom#running-jsdom-inside-a-web-browser)

##### Running JSDOM inside a web browser

jsdom has some support for being run inside a web browser, using browserify. Inside a web browser, we can use a browserified jsdom to create an entirely self-contained set of plain JavaScript objects that look and act much like the browser's existing DOM objects while being entirely independent of them. "Virtual DOM,” indeed!

jsdom's primary target is still Node.js, and so we use language features that are only present in recent Node.js versions (namely, Node.js v8+). Thus, older browsers will likely not work. (Even transpilation will not help: we use Proxys extensively throughout the jsdom codebase.)

Notably, jsdom works well inside a web worker. The original contributor, @lawnsea, who made this possible, has published a paper about his project which uses this capability.

Not everything works perfectly when running jsdom inside a web browser. Sometimes that is because of fundamental limitations (such as not having filesystem access). Still, sometimes it is simply because we haven't spent enough time making the appropriate minor tweaks. Bug reports are certainly welcome.

##### Discussion

[https://github.com/jsdom/jsdom/issues/245](https://github.com/jsdom/jsdom/issues/245)
[https://github.com/jsdom/jsdom/issues/1284](https://github.com/jsdom/jsdom/issues/1284)
[https://github.com/jsdom/jsdom/issues/2427](https://github.com/jsdom/jsdom/issues/2427)

### How To use JSDOM on LEAF-Writer Validator Web Worker

A browserified and fixed version of jsdom (v. 16.6.0) is already in place on the web workers folder `/src/lib/jsdom`

If the file needs to be updated or regenerated, follow these steps:

1. Install JSDOM and Browserify
`npm install -D jsdom browserify`

2. Browserify jsdom
`npm run browserify-jsdom` (check package.json for the details)

3. Fixes
3.1 fix *AsyncIteratorPrototype*
AsyncIteratorPrototype is throwing an error when running on workers. We return it as an empty object since we don't use this method.

- Open /src/web workers/lib/jsdom/jsdon-browserified.js`
- locate the line where AsyncIteratorPrototype is defined.
- replace this line: `const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);`
- for this one: `const AsyncIteratorPrototype = {};`

3.2 fix *SharedArrayBuffer*
SharedArrayBuffer is throwing an error when running on workers. We return it as an empty object since we don't use this method.

- Open /src/web workers/lib/jsdom/jsdon-browserified.js`
- locate the line where sabByteLengthGetter is defined.
- replace this line: `const sabByteLengthGetter = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength").get;`
- for this one: `const sabByteLengthGetter = {}`;

### Unit tests

We use **Jest** and **jest-fetch-mock** for unit tests.
Run `npm test`
