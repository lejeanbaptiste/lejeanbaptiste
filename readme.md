# Le Jean-Baptiste

Le Jean-Baptiste is a desktop XML markup editor forked from the in-browser tool [LEAF-Writer](https://leaf-writer.leaf-vre.org/), part of [The Linked Editing Academic Framework](https://www.leaf-vre.org/) (LEAF) tool suite. LEAF-Writer is an enhancement of the CWRC-Writer developed by the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca), and was developed alongside the [Named Entity Recognition Vetting Environment](https://nerve.lincsproject.ca/en) (NERVE). The project website is [github.com/lejeanbaptiste/lejeanbaptiste](https://github.com/lejeanbaptiste/lejeanbaptiste). Le Jean-Baptiste wraps the web app in Electron for offline, individual desktop use and includes workflow changes aimed particularly at local editing and East Asian documents.

GPL-2.0 · [Commitizen friendly](http://commitizen.github.io/cz-cli/)

## License and attribution

This repository is licensed under `GPL-2.0`. Third-party runtime components keep their own upstream licenses, including the heavily customized `TinyMCE` editor used by LEAF-Writer.

For a concise list of the major bundled components and where to verify their license terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Credits

- **[LEAF](https://www.leaf-vre.org/)** (The Linked Editing Academic Framework) — Le Jean-Baptiste is a desktop fork of [LEAF-Writer](https://leaf-writer.leaf-vre.org/), itself an enhancement of CWRC-Writer from the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca).
- **[Sanmiao](https://github.com/PotatoSinology/sanmiao)** — Chinese, Japanese, and Korean historical calendar conversion by Daniel Patrick Morgan (CNRS-CRCAO), bundled as the desktop app's date-conversion back end. MIT licensed.
- **[Adventurer](https://www.figma.com/community/file/1184595184137881796)** by Lisa Wischofsky ([@lischi_art](https://www.instagram.com/lischi_art/)) — the player-avatar art in the achievement system, distributed via [DiceBear](https://www.dicebear.com/styles/adventurer) and licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the rest of the bundled runtime components (TinyMCE, Font Awesome, Lato, etc.) and their license terms.

## Desktop paradigm

LEAF-Writer is designed for server deployment, connecting XML corpora via Git, which provides file versioning and easy group access for teams. The disadvantages of this model are that it requires internet access, running one's own server if one wants to use a modified version, and using Git for corpus sharing, backup, and versioning. It is also necessarily slower and clunkier when working with local files. Le Jean-Baptiste is designed to work quickly and naturally with local files, with or without internet connection.

LEAF-Writer is also wired to connect to five authorities — VIAF, Wikidata, Getty, DBpedia, and GeoNames — to pull identifiers and data about the named entities therein. Le Jean-Baptiste keeps that functionality and adds desktop-first local authority packs and entity databases for East Asian (and other) corpora.

## Overview

Le Jean-Baptiste is a WYSIWYG XML editor built around a heavily customized [TinyMCE](https://www.tiny.cloud/) core (from LEAF-Writer), packaged as an Electron desktop app. This README focuses on the desktop fork. Planning notes and architecture docs live under [docs/](docs/README.md).

## Asset sources

Artwork and spoiler-protected game assets come from the private [visual_design](https://github.com/lejeanbaptiste/visual_design) repo. Run `npm run visual-design:sync` to refresh the mirrored files in this repo.

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
- `apps/commons/src/icons/tool_{correction,transform,hide_notes,show_notes}.{svg,dark.svg}`
- `apps/commons/src/assets/images/norbert-mini.png`
- `apps/commons/src/desktop/achievements/definitions.ts`
- `apps/desktop/resources/game-assets/assets.bin`
- `apps/desktop/src/generated/gameAssetKey.ts`
- `apps/desktop/resources/avatar-parts/**` (Adventurer avatar-part layers — not spoiler-protected, mirrored as plain SVG files)

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
- Auto-tagging and disambiguation with local authority packs (CBDB, DILA, Wikidata, NDL, …) and plugins such as Sanmiao and Norbert.

## Install

Download the installer for your platform from the [latest release](https://github.com/lejeanbaptiste/lejeanbaptiste/releases/latest). All release assets can be verified as described in [SECURITY.md](SECURITY.md).

### macOS

1. Download the `.pkg` for your machine: `arm64` (Apple silicon) or `x64` (Intel).
2. Open the `.pkg` file and follow the installer. The packages are signed and notarized, so Gatekeeper accepts them without warnings.
3. The application will be installed to `/Applications/Le Jean-Baptiste.app`.
4. Signed updates are checked automatically when the application starts and every four hours. A downloaded update is installed when the application quits. The `.pkg` is only needed for the first installation.

### Windows

1. Download the installer for your machine: `arm64` for Windows on Arm or `x64` for Intel/AMD (`Le-Jean-Baptiste-win-Setup-<version>-<arch>.exe`).
2. Run the installer and follow the prompts. Choose your installation directory and start-menu shortcut preferences.
3. **Note:** The installer is not signed by a certificate authority. Windows Defender SmartScreen may show a warning. To proceed, click "More info" → "Run anyway". A signed package through the Microsoft Store is planned.
4. Updates are checked automatically when the application starts and every four hours. A downloaded update is installed when the application quits.

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

1. Download `Le-Jean-Baptiste-linux-<version>-amd64.deb` (or `-arm64.deb`).
2. Install with your package manager: `sudo apt install ./Le-Jean-Baptiste-linux-<version>-amd64.deb`

**Flatpak (x86_64):**

1. Download `Le-Jean-Baptiste-linux-flatpak-<version>-x86_64.flatpak`.
2. Install with: `flatpak install ./Le-Jean-Baptiste-linux-flatpak-<version>-x86_64.flatpak`

For detailed build and packaging information, see [apps/desktop/README.md](apps/desktop/README.md).

## Build From Source

See [apps/desktop/README.md](apps/desktop/README.md) for the compilation and packaging instructions.

## Bugs / work in progress

- [x] Remove legacy help pop-ups all together: 'copying for first time', 'welcome to editor'
- [x] 'Exiger un XML bien... ' goes in the Garde-fous section of the settings panel
- [x] Welcome splash: include toggle to activate/disactivate advanced features (direct XML editing), 
- [x] Removed legacy 'Show entities' option from settings.
- [x] Currently, the editor pane follows system style regardless of settings choice; it should follow the choice made in the settings panel, like everything else (one of which is follow system style).
- [x] Add a note in place, office, and work database cards: 'Awaiting reflection/user input'
- [x] Database window should not always default to an office name on opening (first entity in database?), especially when set to the person category-maybe load the last entity opened, or the first from the category chosen.
- [x] Norbert: tag noble title not needed anymore in the central toolbar, since it is integrated into the add tag palette.
- [x] Complete overhaul of settings, integrating all settings into single tab-separated panel.
- [x] Data privacy tab
- [x] Simplify hamburger menu.

TEST

- [ ] TinyMCE still failing to load on start up half the time in macOS
- [ ] Stupid validation error when saving in Source mode 
- [ ] Instead of all the loading nonsense, let's have a welcome screen on startup: 'Welcome back XX'... maybe


## Plans

### Next release

#### Asset packs

- [ ] Rerun Norbert concordance test: zi + dynasty + family name + given name ON WIKIDATA + CBDB (?)
- [ ] Import current matches
- [ ] Filter + chunk concordance for smoother loading into memory
- [ ] Japanese pack: ask AI to identify patterns to the garbage, then clean asset packs

#### Push limits

- [ ] Cut TinyMCE startup in half again?
- [ ] Fully reproduce Oxygen source editing experience?
- [ ] Explore LanguageTool plugin for translation and note surfaces.
- [ ] Navigate xml tree in-editor with some sort of dead key ?

#### Other

- Finish word plugin
  - [ ] Different name forms
  - [ ] Production version 
- [ ] Make AI assist actually useful
- [ ] Time Machine polish: diff preview, export history zip, optional `revisionDesc` on restore, delete (?)

### Future

#### Translation pane

- [ ] Improve translation pane word-processing features.
- [ ] Integrate entity-Zotero ?
- [ ] Copy-and-paste export of paragraphs with translation for word processors

#### I/O

- Full CBETA integration
  - [ ] Custom schema / conversion ?
  - [ ] Include Bingenheimer's tagged bios
  - [ ] Search tool imitating CBETA
  - [ ] Bookmarks ?
- Kanripo
  - [ ] Importer
  - [ ] Parser
  - [ ] Normaliser
  - [ ] Punctuator
- [ ] Import profiles (rule engine + mandoku hand profile)
- [ ] Docx / Mammoth import
- [ ] AI-inferred import profiles
- [ ] Browser-extension / URL corpus→TEI extraction (E0–E5 — [corpus-extraction-planning.md](docs/corpus-extraction-planning.md))
- [ ] (IF someone actually uses markdown) Import Phase 1 leftovers: md `{{header}}`, batch/folder UI, validator + provenance
- [ ] (IF grows to point where relevant) LaTeX export

#### UX

- [ ] finish localisations
- [ ] Redo icons : highlight
- [ ] Official titles dictionaries, dates dictionaries for hover-over
- [ ] Find/replace Phase 2b: WYSIWYG visible-text replace across markup
- [ ] Match-case / persist last find query (optional)
- [ ] Ignore page breaks, line breaks, and corrections in tagging and disambiguation?
- [ ] (DREAM): reproduce Oxygen functionalities in Monaco
- [ ] (ABANDONNED as hopeless) Tag-boundary Bugs B/C/H (typing/delete at edges)

#### Maps

- [ ] Labels
- [ ] Click to disambiguate
- [ ] Placename Phase 4–5: persisted coordinate/id place entities; mint from merged periods ([placename-geo-disambiguation-planning.md](docs/placename-geo-disambiguation-planning.md))

#### Dates

- [ ] Parallel Chinese / Japanese dates
- [ ] Import DILA markers into Sanmiao
- [ ] AI assist for Sanmiao to identify beginning of dynasties, reigns, era

#### Authority packs

- [ ] TEI appointment encoding for office/role context

#### Collaboration

- [ ] Option to track annotator on the tag level for collaborations.

#### AI

- [ ] AI auto-tag: apply audit actions beyond `add` (remove/retag/redraw); schema-driven tag picker; prompt-profile UI

#### Technical

- [ ] Further Norbert functions
- [ ] Support for custom authorities and personal SQL databases
- [ ] Multi-machine offline sync beyond current mirror
- [ ] Performance: virtualize review + disambiguation lists; Monaco theme without recreate ([performance-planning.md](docs/performance-planning.md))
- [ ] Bundle size: icon barrel / storage-service; strip prod jotai-devtools; lazy dialogs/Monaco ([bundle-size-warning-planning.md](docs/bundle-size-warning-planning.md))
