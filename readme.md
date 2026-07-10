# Le Jean-Baptiste

<img src="design/splash_new.png" alt="splash" height="300">

Le Jean-Baptiste is a desktop XML markup editor forked from the in-browser tool [LEAF-Writer](https://leaf-writer.leaf-vre.org/), part of [The Linked Editing Academic Framework](https://www.leaf-vre.org/) (LEAF) tool suite. LEAF-Writer is an enhancement of the CWRC-Writer developed by the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca), and was developed alongside the [Named Entity Recognition Vetting Environment](https://nerve.lincsproject.ca/en) (NERVE). The project website is [gitlab.huma-num.fr/dmorgan1/lejeanbaptiste](https://gitlab.huma-num.fr/dmorgan1/lejeanbaptiste). Le Jean-Baptiste wraps the web app in Electron for offline, individual desktop use and includes workflow changes aimed particularly at local editing and East Asian documents.

![GPL-2.0](https://img.shields.io/badge/license-GPL--2.0-orange)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## License and attribution

This repository is licensed under `GPL-2.0`. Third-party runtime components keep their own upstream licenses, including the heavily customized `TinyMCE` editor used by LEAF-Writer.

For a concise list of the major bundled components and where to verify their license terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).


## Desktop paradigm

LEAF-Writer is designed for server deployment, connecting XML corpora via Git, which provides file versioning and easy group access for teams. The disadvantages of this model are that it requires internet access, running one's own server if one wants to use a modified version, and using Git for corpus sharing, backup, and versioning. It is also necessarily slower and clunkier when working with local files. Le Jean-Baptiste is designed to work quickly and naturally with local files, with or without internet connection.

LEAF-Writer is also wired to connect to five authorities - VIAF, Wikidata, Getty, DBpedia, and GeoNames - to pull identifiers and data about the named entities therein. Le Jean-Baptiste keeps that functionality and leaves room for desktop-first workflows and later local-data enhancements.

## Overview

LEAF-Writer is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation.  
It is built around a heavily customized version of the [TinyMCE](https://www.tiny.cloud/) editor, and includes a CWRC-hosted XML validation service.

A LEAF-Writer installation is a bundling of the main LEAF-WriterBase (the code in this repository) with a few other NPM packages that handle interaction with server-side services for document storage and named entity lookup.

This README now focuses on the desktop fork and its shared packages. Some of the older LEAF-Writer notes are still useful background, but the fork-specific workflow is the priority here.

## Enhanced functions



### Window bar

- File tabs



### Left panel

- Fully functional file explorer to manage a project
- Find and replace covering file, open tabs, selected resources, and project. Also includes regular expressions.
- Xpath query, also for file, open tabs, selected resources, and project.
- Table of contents (inherited)
- XML tree (inheritend)
- Entities (inherited)



### Right panel

- File metadata
- Tag attributes
- Image viewer (inherited)
- Schema validation (inherited)



### Bottom bar

- Markup & linking (inherited)
- Annotation mode (inherited)
- XML schema (inherited)
- Visual (WYSIWYG) or source XML viewer.



### Keyboard shortcuts

- `enter`, nothing selected: insert tag OR split `<p>` paragraph.
- `enter`, on selection: wrap in tag
  - `enter`: commit
  - `shift+enter`: tag all identical strings the same way
  - `alt+enter`: walk through all identical strings to decide case-by-case
- `alt+enter`, on selection: add attribute
- `shift+enter`, in `<p>`: immediately split paragraph.
- `F2`: rename element
  - `enter`: commit
  - `shift+enter`: rename all `<tag>` elements wrapping the identical string
  - `alt+enter`: walk

## Running Le Jean-Baptiste

Docker and Docker Compose are required. The easiest path is to install [Docker Desktop](https://www.docker.com/products/docker-desktop).

Clone this repo:
```bash
git clone https://gitlab.huma-num.fr/dmorgan1/lejeanbaptiste.git
```
The `apps/desktop` package wraps our modified LEAF-Writer Commons in an Electron shell for local project editing (folder tree, tabs, save to disk, XPath search).
```bash
npm run dev:desktop
```
See [apps/desktop/README.md](apps/desktop/README.md) for build and packaging instructions.
