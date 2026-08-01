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

## TODO

Near-term work pulled from the planning docs ([docs/README.md](docs/README.md)). Larger later items stay under **Future**.

### Tagging / Norbert / Sanmiao

- [ ] f asset raise needs repositioning. -> recompile (throw in more bw assets)
- [ ] 竟陵王子良 shows up as persname; we are not tagging title + given name !
- [ ] Auto parse and organise noble titles
- [ ] Noble title and person wrapper tagging (testing).
- [ ] Norbert personWrapper: resolve accepted wrappers to exactly one person key; validation for missing/ambiguous keys
- [ ] Norbert expander cache + refresh/startup scheduling; include wrappers/`roleName` in validation panel
- [ ] Finish Sanmiao date curator (ambiguous + sequential re-resolve)
- [ ] Redo icons : highlight
- [ ] Finish word plugin

### Entity database / sync

- [x] Add notes to all elements, e.g. to explain how one knows a date of death.
- [x] Wire fork-merge menu entry
- [x] Bridge conflict “pick a value” UI (beyond inbox list)
- [ ] Run entity-sync manual scenarios ([entity-sync-manual-test-plan.md](docs/entity-sync-manual-test-plan.md))
- [x] i18n for new sync/dialog strings
- [ ] SQLite: drop leftover XML soft-fallbacks after confidence
- [x] SQLite: avoid full panel reloads on single-field edits
- [x] Finish wordprocessor write paths against SQLite

### Editor / UX polish

- [ ] Tag-boundary Bugs B/C/H (typing/delete at edges); remove debug logs
- [ ] Authority UI: per-source pre-run match counts; DILA look-alikes when both match; disable-tier cleanup
- [ ] Memory-profile full CBDB pack load, chunk ?
- [ ] Import Phase 1 leftovers: md `{{header}}`, batch/folder UI, validator + provenance

## Future

### Deprioritised

- [ ] Further Norbert functions
- [ ] AI auto-tag: apply audit actions beyond `add` (remove/retag/redraw); schema-driven tag picker; prompt-profile UI

### UX

- [ ] finish localisations
- [ ] Improve translation pane word-processing features.
- [ ] LanguageTool as a plugin
- [ ] Official titles dictionaries, dates dictionaries for hover-over
- [ ] Copy-and-paste export of paragraphs with translation for word processors
- [ ] LaTeX export
- [ ] Time Machine polish: diff preview, export history zip, optional `revisionDesc` on restore, delete (?)
- [ ] Find/replace Phase 2b: WYSIWYG visible-text replace across markup
- [ ] Match-case / persist last find query (optional)

### Import

- [ ] Full CBETA integration
- [ ] Kanripo
- [ ] Import profiles (rule engine + mandoku hand profile)
- [ ] Docx / Mammoth import
- [ ] AI-inferred import profiles
- [ ] Browser-extension / URL corpus→TEI extraction (E0–E5 — [corpus-extraction-planning.md](docs/corpus-extraction-planning.md))

### Maps

- [ ] VALIDATE: Block zooming to bounds of map tiles
- [ ] Labels
- [ ] Click to disambiguate
- [ ] Placename Phase 4–5: persisted coordinate/id place entities; mint from merged periods ([placename-geo-disambiguation-planning.md](docs/placename-geo-disambiguation-planning.md))

### Dates

- [ ] Parallel Chinese / Japanese dates
- [ ] Import DILA markers into Sanmiao
- [ ] AI assist for Sanmiao to identify beginning of dynasties, reigns, era

### Authority packs

- [ ] Wikidata tag packs (dump extract → LJB packs; zh-hant places)
- [ ] NDL / Japanese pack polish beyond first download
- [ ] GeoNames packs
- [ ] VIAF↔Wikidata precompiled concordance
- [ ] TEI appointment encoding for office/role context
- [ ] AI Phase 6 ranking; MARKUS-style multi-source tag bomb paradigm

### Collaboration

- [ ] Option to track annotator on the tag level for collaborations.

### Technical

- [ ] Support for custom authorities and personal SQL databases
- [ ] Generalized first-run SQLite migration (beyond this install)
- [ ] Multi-machine offline sync beyond current mirror
- [ ] Performance: virtualize review + disambiguation lists; Monaco theme without recreate ([performance-planning.md](docs/performance-planning.md))
- [ ] Bundle size: icon barrel / storage-service; strip prod jotai-devtools; lazy dialogs/Monaco ([bundle-size-warning-planning.md](docs/bundle-size-warning-planning.md))
