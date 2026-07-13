# Le Jean-Baptiste

<img src="design/splash_new.png" alt="splash" height="300">

Le Jean-Baptiste is a desktop XML markup editor forked from the in-browser tool [LEAF-Writer](https://leaf-writer.leaf-vre.org/), part of [The Linked Editing Academic Framework](https://www.leaf-vre.org/) (LEAF) tool suite. LEAF-Writer is an enhancement of the CWRC-Writer developed by the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca), and was developed alongside the [Named Entity Recognition Vetting Environment](https://nerve.lincsproject.ca/en) (NERVE). The project website is [github.com/lejeanbaptiste/lejeanbaptiste](https://github.com/lejeanbaptiste/lejeanbaptiste). Le Jean-Baptiste wraps the web app in Electron for offline, individual desktop use and includes workflow changes aimed particularly at local editing and East Asian documents.

![GPL-2.0](https://img.shields.io/badge/license-GPL--2.0-orange)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## License and attribution

This repository is licensed under `GPL-2.0`. Third-party runtime components keep their own upstream licenses, including the heavily customized `TinyMCE` editor used by LEAF-Writer.

For a concise list of the major bundled components and where to verify their license terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).


## Desktop paradigm

LEAF-Writer is designed for server deployment, connecting XML corpora via Git, which provides file versioning and easy group access for teams. The disadvantages of this model are that it requires internet access, running one's own server if one wants to use a modified version, and using Git for corpus sharing, backup, and versioning. It is also necessarily slower and clunkier when working with local files. Le Jean-Baptiste is designed to work quickly and naturally with local files, with or without internet connection.

LEAF-Writer is also wired to connect to five authorities - VIAF, Wikidata, Getty, DBpedia, and GeoNames - to pull identifiers and data about the named entities therein. Le Jean-Baptiste keeps that functionality and leaves room for desktop-first workflows and later local-data enhancements.

## Overview

LEAF-Writer is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation. It is built around a heavily customized version of the [TinyMCE](https://www.tiny.cloud/) editor, and includes a CWRC-hosted XML validation service.

A LEAF-Writer installation is a bundling of the main LEAF-WriterBase (the code in this repository) with a few other NPM packages that handle interaction with server-side services for document storage and named entity lookup.

This README now focuses on the desktop fork and its shared packages. Some of the older LEAF-Writer notes are still useful background, but the fork-specific workflow is the priority here.

## What is built

Le Jean-Baptiste is the desktop, offline-first fork of LEAF-Writer. The current build already supports:

- Opening a local project folder and bootstrapping its schema and project metadata.
- Browsing XML files in a project tree, with multiple tabs in one window.
- Saving edits back to disk, including the new-file and Save As flow for untitled documents.
- Editing in both visual and source modes.
- Finding and replacing text across a file, open tabs, selected resources, or the whole project.
- Running XPath queries across the same project scopes.
- Inspecting project and file metadata in the side panels.
- Editing tag attributes, schema validation, XML tree navigation, table of contents, and entity tools inherited from LEAF-Writer.
- Using keyboard-driven markup shortcuts for wrapping, inserting, renaming, attribute entry, and bulk propagation.
- Working with translation companions in split-pane form for paired source/translation editing.

## Install

Download the installer for your platform from the [v0.0.1 release](https://github.com/lejeanbaptiste/lejeanbaptiste/releases/tag/v0.0.1):

### macOS

1. Download `Le.Jean-Baptiste-0.0.1-arm64.pkg` (Apple silicon).
2. Open the `.pkg` file and follow the installer.
3. The application will be installed to `/Applications/Le Jean-Baptiste.app`.
4. Updates are checked automatically and installed in the background.

### Windows

1. Download `Le.Jean-Baptiste.Setup.0.0.1.exe`.
2. Run the installer and follow the prompts. Choose your installation directory and start-menu shortcut preferences.
3. **Note:** The installer is not signed by a certificate authority. Windows Defender SmartScreen may show a warning. To proceed, click "More info" → "Run anyway".
4. The application will check for updates automatically on startup.

### Linux

**Debian/Ubuntu (amd64):**

1. Download `le-jean-baptiste-desktop_0.0.1_amd64.deb`.
2. Install with your package manager: `sudo apt install ./le-jean-baptiste-desktop_0.0.1_amd64.deb`

**Flatpak (all architectures):**

1. Download `Le.Jean-Baptiste-0.0.1-x86_64.flatpak`.
2. Install with: `flatpak install ./Le.Jean-Baptiste-0.0.1-x86_64.flatpak`

**APT repository (amd64 only):**

For automatic updates, add the project's APT repository:

```bash
# Add the repository signing key
wget -O- https://lejeanbaptiste.github.io/apt/le-jean-baptiste-archive-key.asc | sudo apt-key add -

# Add the repository to your sources
echo "deb https://lejeanbaptiste.github.io/apt stable main" | sudo tee /etc/apt/sources.list.d/le-jean-baptiste.sources > /dev/null

# Install and keep updated
sudo apt update
sudo apt install le-jean-baptiste-desktop
```

For detailed build and packaging information, see [apps/desktop/README.md](apps/desktop/README.md).

## Build From Source

See [apps/desktop/README.md](apps/desktop/README.md) for the compilation and packaging instructions.
