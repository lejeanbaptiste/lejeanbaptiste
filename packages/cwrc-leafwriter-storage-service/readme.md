# LEAF-Writer Storage Service

![NPM](https://img.shields.io/npm/l/@cwrc/leafwriter-storage-service)
[![version](https://img.shields.io/npm/v/@cwrc/leafwriter-storage-service.svg)](https://www.npmjs.com/package/@cwrc/leafwriter-storage-service)
![npm type definitions](https://img.shields.io/npm/types/@cwrc/leafwriter-storage-service)

## Table of Contents

- [LEAF-Writer Storage Service](#leaf-writer-storage-service)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Demo](#demo)
  - [Use](#use)
    - [Install](#install)
    - [Basic Examples](#basic-examples)
      - [Load Dialog](#load-dialog)
      - [Save Dialog](#save-dialog)
    - [Full Feature Examples](#full-feature-examples)
      - [Load Dialog](#load-dialog-1)
      - [Save Dialog](#save-dialog-1)
    - [React Suspense](#react-suspense)
  - [Bypass the Dialog with handy functions](#bypass-the-dialog-with-handy-functions)
    - [loadDocument](#loaddocument)
    - [saveDocument](#savedocument)
  - [API](#api)
    - [Dialog props](#dialog-props)
    - [StorageDialogConfig](#storagedialogconfig)
    - [Resource](#resource)
  - [Development](#development)

## Overview

This is React File Storage component for listing, loading, and saving files from and to the local computer and Git hosting (GitHub and Gitlab). It was built to be used in conjunction with [LEAF-Writer-Commons](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer), but it is general enough to be freely used anywhere.

The **Load Dialog** supports pasting from the clipboard, selecting files from the local computer, dragging & drop a file directly to the UI, and load from an URL or Git provider (GitHub | Gitlab). On the git provider, users can access their own repositories, shared repositories, repositories owned by organizations/groups, and search public repositories. Git repositories are limited to the default branch (usually 'master' or 'main'). There are also search functionalities by file name and within files' content.

The **Save Dialog** supports downloading to the local computer and saving to Git hosting. On the git hoster, users can create new repositories and new folders and create and overwrite files. Optionally, users can make Pull Requests, saving the file into a different branch. If the user does not have written permission to a repository, they can Fork the repository and make a Pull Request to the original repository.

Extra features:

- Bypass the dialog UI with a streamlined function to save/load resources.
- Pass validation function before load.
- Define a commit message.
- Show/hide invisible files.
- Restrict files by MIME type.
- **Responsive**: Adapts to large displays and mobile devices.
- **Dark mode**: light and dark themes.
- **Localized**: English and French.

- Fully typed with **Typescript**.

## Demo

The [LEAF-Writer Commons](https://leaf-writer.leaf-vre.org/) is running an instance of [LEAF-Writer](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/tree/main/packages/core) that uses the NPM package published from this repository.

## Use

### Install

```nodejs
npm i @cwrc/leafwriter-storage-service
```

### Basic Examples

#### Load Dialog

```ts
import React, { useState } from  'react';
import StorageDialog from  '@cwrc/leafwriter-storage-service/Dialog';

export  const  MyFStorageDialog  = () => {
 const [open, setOpen] =  useState(true);

 const  handleClose  = () =>  setOpen(false);
 const  handleLoad  = () =>  setOpen(false);

 return (
    <StorageDialog
      onCancel={close}
      onLoad={handleLoad}
      open={open}
      type="load"
    />
  );
};
```

If the property `type` is not defined, the component displays the Load Dialog. Property `open` controls the component visibility; `onCancel` is triggered by the `cancel` button; `onLoad` is triggered by the `load` button.

#### Save Dialog

```ts
import React, { useState } from 'react';
import StorageDialog from '@cwrc/leafwriter-storage-service/Dialog';

export const MyFStorageDialog = () => {
  const [open, setOpen] = useState(true);

  const handleClose = () => setOpen(false);
  const handleSave = () => setOpen(false);

  return (
    <StorageDialog
      onCancel={close}
      onSave={handleSave}
      open={open}
      type="save"
    />
  );
};
```

Property `open` controls the component visibility; `onCancel` is triggered by the `cancel` button; `onSave` is triggered by the `load` button.

### Full Feature Examples

#### Load Dialog

```ts
import React, { useState } from 'react';
import StorageDialog from '@cwrc/leafwriter-storage-service/Dialog';
import type { Resource } from '@cwrc/leafwriter-storage-service';

export const MyFStorageDialog = () => {
  const [open, setOpen] = useState(true);

  const handleBackdropClick = () => {
    //do something
    setOpen(false);
  }

  const handleClose = () => {
    //do something
    setOpen(false);
  }

  const handleChange = (resource?: Resource) => {
    //do something with the resource currrent state (e.g., update URL)
  };

  const handleLoad = (resource: Resource) => {
    //do something with the resource loaded
    setOpen(false);
  }

  const handleValidation = (content: string):boolean => {
    //validate content and return true or false.
  };

  return (
    <StorageDialog
      config={{
        allowedMimeTypes: ['application/xml'],
        allowLocalFiles: true,
        allowUrl: true,
        allowPaste: true,
        language: 'en-CA',
        preferProvider: 'github',
        providers: [
          { name: 'github', access_token: '{github_token}' },
          { name: 'gitlab', access_token: '{github_token}' }
        ],
        showInvisibleFiles: true,
        validate: handleValidation,
      }}
      headerLabel="Custom header"
      onBackdropClick={clickAway}
      onCancel={close}
      onChange={handleOnChange}
      onLoad={handleLoad}
      resource={
        storageSource: 'cloud | url | local | paste'
        provider: 'github | gitlab',
        owner: 'username | userid',
        ownerType: 'user',
        repo: 'repository-name| repository-id',
        path: 'path/to/documents',
        writePermission: true,
      }
      open={open}
      source="cloud"
    />
  );
};
```

See the API section for more details.

#### Save Dialog

```ts
import React, { useState } from 'react';
import StorageDialog from '@cwrc/leafwriter-storage-service/Dialog';
import type { Resource } from '@cwrc/leafwriter-storage-service';

export const MyFStorageDialog = () => {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    //do something
    setOpen(false);
  }

  const handleSave = (Resource: Resource) => {
    //do something
    setOpen(false);
  }

  return (
    <StorageDialog
      config={{
        allowedMimeTypes: ['application/xml'],
        defaultCommitMessage: 'Updated via leaf-writer',
        language: 'en-CA',
        preferProvider: 'github_or_gitlab',
        providers: [
          { name: 'github', access_token: '{github_token}' },
          { name: 'gitlab', access_token: '{github_token}' }
        ],
        showInvisibleFiles: true,
      }}
      headerLabel="Custom header"
      onCancel={close}
      onSave={handleSave}
      resource={
        storageSource: 'cloud | local'
        provider: 'github | gitlab',
        owner: 'username | userid',
        ownerType: 'user',
        repo: 'repository-name | repository-id',
        path: 'path/to/documents';
        filename: 'filename',
        content: 'the content of the decument',
        hash: 'sha',
      }
      open={open}
      source="cloud"
    />
  );
};
```

See the API section for more details.

### React Suspense

You can use React suspense to optimize your code. The module will only be loaded when the Dialog is triggered for the first time.

Example:

```ts
import React, { Suspense useState } from  'react';
const StorageDialog = React.lazy(() => import('@cwrc/leafwriter-storage-service/Dialog'));

export  const  MyFStorageDialog = () => {
 const [open, setOpen] = useState(true);

 const handleClose = () =>  setOpen(false);
 const handleLoad = () =>  setOpen(false);

 return (
    <>
      { open === true && (
        <Suspense fallback={<Progress />}>
          <StorageDialog
            onCancel={close}
            onLoad={handleLoad}
            open={open}
            type="load"
          />
        </Suspense>
      )}
    </>
  );
};
```

## Bypass the Dialog with handy functions

### loadDocument

Use this function to load a document from a git provider without opening the dialog. You must pass the provider authorization and the resource location.

The function returns the resource with the content and its hash.

```ts
import { loadDocument } from '@cwrc/leafwriter-storage-service/headless';
import type { Resource } from '@cwrc/leafwriter-storage-service';

const providerAuth = {
  name: 'github',
  access_token: 'token'
}

const resource: Resource = {
  provider: 'github',
  owner: 'username',
  ownerType: 'user',
  repo: 'repository-name',
  path: 'path/to/documents';
  filename: 'filename'
}

const document: Resource = await loadDocument(providerAuth, resource);
```

### saveDocument

Use this function to save a document to a git provider without opening the dialog. You must pass the provider authorization and the resource object, including the location, filename, and content.

By default, the function will not overwrite any file. To overwrite, you must pass a third argument, `true` and provide the hash for the file in the resource object.

The function returns the resource with the content and a new hash.

```ts
import { saveDocument } from '@cwrc/leafwriter-storage-service/headless';
import type { Resource } from '@cwrc/leafwriter-storage-service';

const providerAuth = {
  name: 'github',
  access_token: 'token'
}

const document: Resource = {
  provider: 'github',
  owner: 'username',
  ownerType: 'user',
  repo: 'repository-name',
  path: 'path/to/documents';
  filename: 'filename',
  content: 'the content of the decument',
}

//creates a new document
const savedDocument: Resource = await saveDocument(providerAuth, resource);

//updates the same document
const overwrittenDocument: Resource = await saveDocument(providerAuth, savedDocument, true);
```

## API

Since Leaf writer Storage Service is written in Typescript, you will get suggestions through IntelliSense.

### Dialog props

| Name            | Type                          | Default | Description                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| open\*          | boolean                       | false   | Display / hide dialog                                                                                                                                                                                                                                                                                                                                                                                   |
| config          | StorageDialogConfig           |         | A collection of configuration (see bellow).                                                                                                                                                                                                                                                                                                                                                             |
| headerLabel     | string                        |         | Dialog's custom header. Ex: instead of `load` you can pass any string, such as `load document`.                                                                                                                                                                                                                                                                                                         |
| onBackdropClick | function                      |         | Callback fired when the **backdrop** is clicked.<br/><br/>**Save dialog** ignores this property since it does not allow for onBackdropClick.                                                                                                                                                                                                                                                            |
| onCancel        | function                      |         | Callback fired when the **Cancel** button is clicked.                                                                                                                                                                                                                                                                                                                                                   |
| onChange        | function                      |         | **Load dialog**: Callback fired when there is any change on the resource source (cloud, local, paste, url), on the resource url when the source is `url`, or on the resource path (owner, repository, folder path) when the source is `cloud`. <br /> <br /> **Save dialog** ignores this property. <br /> <br /> **Signature**: `function(resource?: Resource) => void` See more about Resource below. |
| onLoad          | function                      |         | **Load dialog**: Callback fired when the **Load** button is clicked. <br /> <br />**Save dialog** ignores this property. <br /> <br /> **Signature**: `function(resource: Resource) => void`. See more about Resource below.                                                                                                                                                                            |
| onSave          | function                      |         | **Save dialog**: Callback fired when the **Save** button is clicked. <br /> <br />**Load dialog** ignore this property. <br /> <br /> **Signature**: `function(resource: Resource) => void`. See more about Resource below.                                                                                                                                                                             |
| resource        | Resource \| string            |         | The resource information, which might include the document's content to be saved.<br /> <br /> **Load Dialog** navigates directly to a specific location. If it is a string, displays `paste` source panel when open.<br /> <br /> **Save Dialog** navigates directly to a specific location, transport the document's content. See more about Resource type bellow.                                    |
| source          | 'cloud' \| 'local' \| 'paste' | 'local' | The storage source panel to be display when dialog opens. If `providers` is defined in the configurations, the dialog opens with the `cloud` source panel.                                                                                                                                                                                                                                              |
| type            | 'load' \| 'save'              | 'load'  | The dialog type to be open.                                                                                                                                                                                                                                                                                                                                                                             |

### StorageDialogConfig

| Name                 | Type                   | Default  | Description                                                                                                                                                                                                      |
| -------------------- | ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allowedMimeTypes     | Array [`MIMEType`]     | []       | Restrict the file types allowed. Empty array means no restriction.<br /> <br /> MIME type suported: `'application/json'`, `'application/pdf'`, `'application/xml'`, `'text/csv'`, `'text/html'`, `'text/plain'`. |
| allowLocalFiles      | boolean                | true     | `Load dialog`: Allows loading files from local device.                                                                                                                                                           |
| allowPaste           | boolean                | true     | `Load dialog`: Allows paste from clipboard.                                                                                                                                                                      |
|                      |
| allowUrl             | boolean                | true     | `Load dialog`: Allows load from URL.                                                                                                                                                                             |
| defaultCommitMessage | string                 | 'update' | `Save Dialog`: Defines the default commit message.                                                                                                                                                               |
| language             | string                 |          | Localize the UI and the messages. Must be valid and supported language code. E.g., `en-CA`                                                                                                                       |
| providers            | Array [`ProviderAuth`] | []       | Setup Github / Gitlab providers.<br /> <br /> `ProviderAuth`: {<br />name: 'github' \| 'gitlab',<br /> access_token: 'string<br />}                                                                              |
| preferProvider       | string                 |          | The preferred git host provider: `'github'` \| `'gitlab'`                                                                                                                                                        |
| showInvisibleFiles   | boolean                | false    | Show/hide invisible files (files starting with `'.'`)                                                                                                                                                            |
| validate             | function               |          | Function fired after the content is fetched but before passed to onLoad funcion.<br /> <br /> **Signature**: `function(content: string) => { valid: boolean; error?: string };`                                  |

### Resource

| Name            | Type                                   | Default | Description                                                                                                                                                                                              |
| --------------- | -------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| storageSource   | `cloud` \| `local` \| `paste` \| `url` |         | The resource's source.                                                                                                                                                                                   |
| url             | string                                 |         | The resource's url. Only for sourceStorage `url` or `cloud`.                                                                                                                                             |
| provider        | string                                 |         | `'github'`, `'gitlab'`, or empty if not from the git repository. Only for sourceStorage `cloud`.                                                                                                         |
| owner           | string                                 |         | Github `username` or Gitlab: `user id`. Only for sourceStorage `cloud`.                                                                                                                                  |
| ownerType       | string                                 |         | `'user'` or `'org'`. Gitlab groups are used here as 'org' notation. Only for sourceStorage `cloud`.                                                                                                      |
| repo            | string                                 |         | Github `repository name`. Gitlab `repository id`. Only for sourceStorage `cloud`.                                                                                                                        |
| branch          | string                                 |         | The repository's brach. It uses the repository's default branch, usually `main` or `master`. Only for sourceStorage `cloud`.                                                                             |
| path            | string                                 |         | Folder structure. _e.g._, `'path/to/file'`. Only for sourceStorage `cloud`.                                                                                                                              |
| filename        | string                                 |         | The file name.                                                                                                                                                                                           |
| content         | string                                 |         | The document content. Only for sourceStorage `cloud`.                                                                                                                                                    |
| hash            | string                                 |         | The Commit hash. On **Github**, it is the SHA value. On **Gitlab**, it is the lastCommitId. If present, the dialog alerts the user that the content will be overwritten. Only for sourceStorage `cloud`. |
| writePermission | boolean                                |         | Indicates if the loged user has write permission for the repository. Default: `undefined` for owned repositories. Only for sourceStorage `cloud`.                                                        |

## Development

This component is part of a leaf writer monorepo. Refer to [LEAF-Writer Dev Docs](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer) for the project's bigger picture.

We use **Material** UI (@mui/material) to build the visual elements, **@octokit/rest** and **axios** to fetch data from and to Github and Gitlab, **overmind** to control react state, and **i18next** for localization.

This component is written in **Typescript** and bundled with **Webpack**.

We use **Jest** for testing.
