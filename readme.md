# Le Jean-Baptiste

<img src=".github/splash.png" alt="Le Jean-Baptiste — XML avec du corps" width="50%">

Le Jean-Baptiste is a desktop XML markup editor forked from the in-browser tool [LEAF-Writer](https://leaf-writer.leaf-vre.org/), part of [The Linked Editing Academic Framework](https://www.leaf-vre.org/) (LEAF) tool suite. LEAF-Writer is an enhancement of the CWRC-Writer developed by the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca), and was developed alongside the [Named Entity Recognition Vetting Environment](https://nerve.lincsproject.ca/en) (NERVE). The project website is [github.com/lejeanbaptiste/lejeanbaptiste](https://github.com/lejeanbaptiste/lejeanbaptiste). Le Jean-Baptiste wraps the web app in Electron for offline, individual desktop use and includes workflow changes aimed particularly at local editing and East Asian documents.

GPL-2.0 · [Commitizen friendly](http://commitizen.github.io/cz-cli/)

## License and attribution

This repository is licensed under `GPL-2.0`. Third-party runtime components keep their own upstream licenses, including the heavily customized `TinyMCE` editor used by LEAF-Writer.

For a concise list of the major bundled components and where to verify their license terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Credits

- **[LEAF](https://www.leaf-vre.org/)** (The Linked Editing Academic Framework) — Le Jean-Baptiste is a desktop fork of [LEAF-Writer](https://leaf-writer.leaf-vre.org/), itself an enhancement of CWRC-Writer from the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca).
- **[Sanmiao](https://github.com/PotatoSinology/sanmiao)** — Chinese, Japanese, and Korean historical calendar conversion by Daniel Patrick Morgan (CNRS-CRCAO), bundled as the desktop app's date-conversion back end. MIT licensed.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the rest of the bundled runtime components (TinyMCE, Font Awesome, Lato, etc.) and their license terms.

## Desktop paradigm

LEAF-Writer is designed for server deployment, connecting XML corpora via Git, which provides file versioning and easy group access for teams. The disadvantages of this model are that it requires internet access, running one's own server if one wants to use a modified version, and using Git for corpus sharing, backup, and versioning. It is also necessarily slower and clunkier when working with local files. Le Jean-Baptiste is designed to work quickly and naturally with local files, with or without internet connection.

LEAF-Writer is also wired to connect to five authorities — VIAF, Wikidata, Getty, DBpedia, and GeoNames — to pull identifiers and data about the named entities therein. Le Jean-Baptiste keeps that functionality and adds desktop-first local authority packs and entity databases for East Asian (and other) corpora.

## Overview

Le Jean-Baptiste is a WYSIWYG XML editor built around a heavily customized [TinyMCE](https://www.tiny.cloud/) core (from LEAF-Writer), packaged as an Electron desktop app. This README focuses on the desktop fork. Planning notes and architecture docs live under [docs/](docs/README.md).

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

### TODO

1. Commit the built data — data/metadata/* (2.5 MB) + data/schema/* (340 KB). The release ships what's committed; nothing regenerates it in CI.	trivial
2. One real end-to-end run in the app — install → enable → Sync from GitHub → search → import a work → open the file → confirm it validates against cbeta_p5.rng. Everything so far is unit tests + headless bridge calls; the actual Electron path is unexercised.	~30 min
3	§10.4 — 5-min check of downgrade.phonetic_glosses against a real 音義 juan (once the corpus is synced), since the fixture is synthetic.	5 min
4	Write down the maintainer refresh recipe — which DILA repos, the crosswalk extraction from authority extraction/dist/…/concordance.ndjson, the gh api …/trees/master file-list. That recipe currently only lives in this conversation.	15 min
5	Conscious calls on two known gaps: 8 obscure works with files: [], and cb_gaiji.json empty (PUA residue keeps <g> — valid TEI, per-file <charDecl> is the source). Both fine as-is; just decide.

- Full CBETA integration
  - [ ] Include Bingenheimer's tagged bios
- [ ] Confirm CBETA schema takes tags
- [ ] Milestone projection matcher for auto-tagging (match across `<lb>` / empty anchors without stripping them — [autotagging-milestone-projection-planning.md](docs/autotagging-milestone-projection-planning.md))

### Future

- [ ] `createCompoundAnchor` (`packages/cwrc-leafwriter/src/autoTagging/anchor.ts:247-248`) computes `localEnd` — the search-index equivalent of `localStart`, which the sibling `createAnchor` function's `rawRange` helper (same file) uses to convert a search-index back to a snapped raw text-node offset — but then never uses it: `endOffset: endRaw` (line 275) returns the _raw, unsnapped_ input instead of the computed-and-normalized value, unlike `offset: startSearch.map[localStart]` a few lines above it, which does apply that snapping for the start boundary. `localEnd` is assigned and read nowhere. This looks like an incomplete port of the pattern `createAnchor`/`rawRange` establish elsewhere in the file, not a deliberate choice — but the existing test (`apply.test.ts:72`) exercises exactly the case where `endRaw` equals the node's full length, where `localEnd`'s `findIndex` would miss (hit the `-1` fallback) and `endRaw` happens to already be correct, so the gap may not be as visible as it should be. This only affects `createCompoundAnchor`'s callers (the post-component person-wrapper pass) and only when the end boundary isn't at a node's natural end, where whitespace-policy snapping could shift the offset. **2026-08-24: low real-world priority** — Asian-script sources normally carry no whitespace, so the whitespace-policy snapping this gap would affect essentially doesn't come up in practice for this project's actual corpus. Still worth fixing for correctness/robustness, but not urgent.

### 'LJBtero' (After testing)

- [ ] Clean up and rationalise options, UI, document and global settings. (Settings dialog reorganised into sections — `authorities`, `editor`, `entity-lookups`, `guardrails`, `markup-panel`, `profile`, `ui`, `reset` — and shipped in beta.2. Still open: the document-level vs global split; everything today is global.)
- [ ] Figure out how best to handle the insertion of entities NOT in said paragraph.
- [ ] Keyboard shortcut for insert entity
- [ ] Build Word and LibreOffice plugins on the same model.
- [ ] Live passage citations in Word / LibreOffice: insert a refreshable field (source unit + optional translation + bibl + nearest page cue) that Syncs from LJB like Zotero — pointers only, no second copy of the edition ([live-passage-citation-planning.md](docs/live-passage-citation-planning.md))

### Database viewer

- [ ] Think about how to organise for rapid data entry
- [ ] Filters beyond entity kind (the kind filter ships and persists via `databaseViewPrefs`; no field-level or faceted filtering yet)

#### UX

- [ ] Find/replace Phase 2b: WYSIWYG visible-text replace across markup ([find-replace-planning.md](docs/find-replace-planning.md))
- [ ] Persist last find query across sessions (match-case / ignore-case and regex toggles already ship; the query itself resets to `''` on mount)
- [ ] Milestone-aware auto-tagging (projection match + wrap around `<lb>` / infrastructure) — [autotagging-milestone-projection-planning.md](docs/autotagging-milestone-projection-planning.md); interim: strip `<lb>` on CBETA import or accept missed spans
- [ ] Re-explore Tag-boundary Bugs B/C/H (typing/delete at edges) keeping us from full Oxygen parity.

#### Dates

- [ ] Allow the setting and display of Sanmiao-style CJK dates in the place of/parallel to Western dates.
- [ ] Scan DILA for markers into Sanmiao
- [ ] AI assist for Sanmiao to identify beginning of dynasties, reigns, era

#### AI

- [ ] Translation panel: check for translation consistency across the document
- [ ] Translation panel: suggest improvements with 'accept/reject'
- [ ] AI-inferred import profiles
- [ ] AI auto-tag: gold harness / residual gaps for `roleName` / `orgName` audit apply (remove/retag/redraw, schema-driven tag picker, and prompt-profile UI already ship)

#### Norbert

- [ ] Consider implementing works/editions
- [ ] Use 'knowledge' category?
- [ ] Consider second-order, relational tags, kinship, appointment, death, knowledge

#### Push limits

- [ ] Instead of relying on Markup panel to navigate the xml tree, introduce some sort of toggle where the keyboard arrow keys move you between siblings, parent, and first child. Preferably a keyboard toggle.
- [ ] Make TinyMCE even faster to load.

#### Technical / collaboration

- [ ] Further Norbert functions
- [ ] Support for custom authorities
- [ ] Support for user SQL databases
- [ ] Multi-machine offline sync beyond current mirror
- [ ] Option to track annotator on the tag level for collaborations.

---

### Pending

#### Maps (pending feedback from historian of geography)

- [ ] Pin captions to further aid in disambiguation
- [ ] Click on map to select in panel
- [ ] Placename Phase 4–5: persisted coordinate/id place entities; mint from merged periods ([placename-geo-disambiguation-planning.md](docs/placename-geo-disambiguation-planning.md))

#### Database cards

- [ ] place (pending feedback from historian of geography)
- [ ] title (pending decisions on how to treat works)

### Deferred

- [ ] TEI appointment encoding for office/role context ([doc](docs/authority-packs-planning.md))
- [ ] Time Machine polish: diff preview, export history zip, optional `revisionDesc` on restore, delete (?)
- [ ] Docx import Phase 3: style-aware mammoth → IR (blind text extraction already ships)
- [ ] Bundle size: icon barrel / storage-service; lazy dialogs/Monaco ([bundle-size-warning-planning.md](docs/bundle-size-warning-planning.md))
- [ ] (IF someone actually uses markdown) Import leftovers: md `{{header}}` expansion, import validator report (blind import, folder multi-select, and basic provenance already ship — see import-planning.md)
- [ ] (IF grows to point where relevant) LaTeX export
