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

## Overview

The Linked Editing Academic Framework (LEAF) has developed an in-browser text markup editor (LEAF-Writer, previoysly know as CWRC-Writer) for use by individual scholars and collaborative scholarly editing projects that require a light-weight online editing environment. This package is the base code that builds the editor as a React component to be embded in any website. A default version of the LEAF-Writer that uses GitHub for storage is available for anyone's use at [https://leaf-writer.leaf-vre.org](https://leaf-writer.leaf-vre.org)

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

Download from the web susing JSDELIVER: [https://www.jsdelivr.com/package/npm/@cwrc/leafwriter](https://www.jsdelivr.com/package/npm/@cwrc/leafwriter)

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
const editor = new Leafwriter.Leafwriter(container); //it must be a HTMLELEMENT (DIV) 

editor.init({
  document: {
    url: 'document_url', // Optional (string)
    xml: '<xml ...>', // Required (string)
  },
  settings: {
    baseUrl: 'path/to/leafwriter/files/', // Optional. Default: '.' 
    lookups: {
      authorities: [['geonames', { config: { username: 'your_geonames_username' } }]], // Optional. Provide your geoname's username to enable Geonames entity lookup
    },
  },
  user: { // Optional. Used to defiine of Web annotations' creator
    name: 'First_name Last_name', 
    uri: 'https://...',
  }
});
```

#### Get current content from the editor

Using assync/await

```ts
//Assuming the instance is named `editor`

const currentContent = await editor.getContent();
console.log(currentContent)

// Or as a Promise
editor.getContent().then((currentContent) => {
  console.log(currentContent)
});
```
