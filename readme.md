# Le Jean-Baptiste

<img src="apps/desktop/resources/branding/splash_new.png" alt="splash" height="300">

Le Jean-Baptiste is a desktop XML markup editor forked from the in-browser tool [LEAF-Writer](https://leaf-writer.leaf-vre.org/), part of [The Linked Editing Academic Framework](https://www.leaf-vre.org/) (LEAF) tool suite. LEAF-Writer is an enhancement of the CWRC-Writer developed by the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca), and was developed alongside the [Named Entity Recognition Vetting Environment](https://nerve.lincsproject.ca/en) (NERVE). The project website is [github.com/lejeanbaptiste/lejeanbaptiste](https://github.com/lejeanbaptiste/lejeanbaptiste). Le Jean-Baptiste wraps the web app in Electron for offline, individual desktop use and includes workflow changes aimed particularly at local editing and East Asian documents.

![GPL-2.0](https://img.shields.io/badge/license-GPL--2.0-orange)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## License and attribution

This repository is licensed under `GPL-2.0`. Third-party runtime components keep their own upstream licenses, including the heavily customized `TinyMCE` editor used by LEAF-Writer.

For a concise list of the major bundled components and where to verify their license terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Credits

- **[LEAF](https://www.leaf-vre.org/)** (The Linked Editing Academic
  Framework) — Le Jean-Baptiste is a desktop fork of
  [LEAF-Writer](https://leaf-writer.leaf-vre.org/), itself an enhancement of
  CWRC-Writer from the [Canadian Writing Research Collaboratory
  (CWRC)](https://cwrc.ca).
- **[Sanmiao](https://github.com/PotatoSinology/sanmiao)** — Chinese,
  Japanese, and Korean historical calendar conversion by Daniel Patrick
  Morgan (CNRS-CRCAO), bundled as the desktop app's date-conversion back
  end. MIT licensed.
- **[Adventurer](https://www.figma.com/community/file/1184595184137881796)**
  by Lisa Wischofsky ([@lischi_art](https://www.instagram.com/lischi_art/))
  — the player-avatar art in the achievement system, distributed via
  [DiceBear](https://www.dicebear.com/styles/adventurer) and licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the rest of the
bundled runtime components (TinyMCE, Font Awesome, Lato, etc.) and their
license terms.

## Desktop paradigm

LEAF-Writer is designed for server deployment, connecting XML corpora via Git, which provides file versioning and easy group access for teams. The disadvantages of this model are that it requires internet access, running one's own server if one wants to use a modified version, and using Git for corpus sharing, backup, and versioning. It is also necessarily slower and clunkier when working with local files. Le Jean-Baptiste is designed to work quickly and naturally with local files, with or without internet connection.

LEAF-Writer is also wired to connect to five authorities - VIAF, Wikidata, Getty, DBpedia, and GeoNames - to pull identifiers and data about the named entities therein. Le Jean-Baptiste keeps that functionality and leaves room for desktop-first workflows and later local-data enhancements.

## Overview

LEAF-Writer is a WYSIWYG text editor for in-browser XML editing and stand-off RDF annotation. It is built around a heavily customized version of the [TinyMCE](https://www.tiny.cloud/) editor, and includes a CWRC-hosted XML validation service.

A LEAF-Writer installation is a bundling of the main LEAF-WriterBase (the code in this repository) with a few other NPM packages that handle interaction with server-side services for document storage and named entity lookup.

This README now focuses on the desktop fork and its shared packages. Some of the older LEAF-Writer notes are still useful background, but the fork-specific workflow is the priority here.

## Asset Sources

Artwork and spoiler-protected game assets come from the private
[`visual_design`](https://github.com/lejeanbaptiste/visual_design) repo.
Run `npm run visual-design:sync` to refresh the mirrored files in this repo.

Tracked here as mirrored or generated assets:

- `apps/desktop/resources/branding/icon.svg`
- `apps/desktop/resources/branding/icon.png`
- `apps/desktop/resources/branding/icons/*.png`
- `apps/desktop/resources/branding/splash.svg`
- `apps/desktop/resources/branding/splash_new.png`
- `apps/commons/src/icons/tab/tab_explorer.{svg,png,dark.svg,dark.png}`
- `apps/commons/src/icons/tab/tab_find.{svg,png,dark.svg,dark.png}`
- `apps/commons/src/icons/tab/tab_xpath.{svg,png,dark.svg,dark.png}`
- `apps/commons/src/icons/tab/tab_toc.{svg,png,dark.svg,dark.png}`
- `apps/commons/src/icons/tab/tab_tree.{svg,png,dark.svg,dark.png}`
- `apps/commons/src/desktop/achievements/definitions.ts`
- `apps/desktop/resources/game-assets/assets.bin`
- `apps/desktop/src/generated/gameAssetKey.ts`
- `apps/desktop/resources/avatar-parts/**` (Adventurer avatar-part layers -
  not spoiler-protected, mirrored as plain SVG files)

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

Download the installer for your platform from the
[latest release](https://github.com/lejeanbaptiste/lejeanbaptiste/releases/latest).
All release assets can be verified as described in [SECURITY.md](SECURITY.md).

### macOS

1. Download the `.pkg` for your machine: `arm64` (Apple silicon) or `x64` (Intel).
2. Open the `.pkg` file and follow the installer. The packages are signed
   and notarized, so Gatekeeper accepts them without warnings.
3. The application will be installed to `/Applications/Le Jean-Baptiste.app`.
4. Update by installing a newer release; automatic in-app updates are planned.

### Windows

1. Download `Le.Jean-Baptiste.Setup.<version>.exe`.
2. Run the installer and follow the prompts. Choose your installation directory and start-menu shortcut preferences.
3. **Note:** The installer is not signed by a certificate authority. Windows Defender SmartScreen may show a warning. To proceed, click "More info" → "Run anyway". A signed package through the Microsoft Store is planned.
4. Update by installing a newer release.

### Linux

**APT repository (Debian/Ubuntu, amd64 and arm64) — recommended, updates automatically:**

```bash
# Add the repository signing key
wget -qO- https://lejeanbaptiste.github.io/lejeanbaptiste/apt/le-jean-baptiste-archive-key.asc \
  | sudo tee /usr/share/keyrings/le-jean-baptiste.asc > /dev/null

# Add the repository to your sources
echo "deb [signed-by=/usr/share/keyrings/le-jean-baptiste.asc] https://lejeanbaptiste.github.io/lejeanbaptiste/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/le-jean-baptiste.list > /dev/null

# Install and keep updated
sudo apt update
sudo apt install le-jean-baptiste-desktop
```

**Standalone .deb (Debian/Ubuntu):**

1. Download `le-jean-baptiste-desktop_<version>_amd64.deb` (or `_arm64.deb`).
2. Install with your package manager: `sudo apt install ./le-jean-baptiste-desktop_<version>_amd64.deb`

**Flatpak (x86_64):**

1. Download `Le.Jean-Baptiste-<version>-x86_64.flatpak`.
2. Install with: `flatpak install ./Le.Jean-Baptiste-<version>-x86_64.flatpak`

For detailed build and packaging information, see [apps/desktop/README.md](apps/desktop/README.md).

## Build From Source

See [apps/desktop/README.md](apps/desktop/README.md) for the compilation and packaging instructions.
