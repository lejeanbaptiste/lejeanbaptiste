# Le Jean-Baptiste

![Le Jean-Baptiste — XML avec du corps](.github/splash.png)

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

## Browser extension (corpus import)

The **LJB corpus import** browser extension lets you send the current **Wikisource**, **Kanripo**, or **BDRC** page straight to Le Jean-Baptiste with one click. It is optional: you can always import the same sources from inside LJB with **File → Import from URL…** (paste the page address). The extension is only a shortcut from the browser toolbar.

Extension zips are attached to the **same [GitHub release](https://github.com/lejeanbaptiste/lejeanbaptiste/releases/latest)** as the desktop installers — look for:

- `ljb-browser-extension-chromium-<version>.zip` — Chrome, Brave, Edge, and other Chromium browsers
- `ljb-browser-extension-firefox-<version>.zip` — Firefox

Use the zips from the release that matches your installed LJB version (for example, if you installed `v0.1.0-beta.6`, download the extension zips whose names end in `0.1.0-beta.6`).

### Before you install the extension

1. **Install Le Jean-Baptiste** (see [Install](#install) above).
2. **Launch LJB at least once** before loading the extension. On first start the app registers a *native-messaging host* on your machine so the browser can talk to the running editor. If you skip this step, the extension icon may appear but **Import** will not reach LJB.
3. **Keep LJB running** when you use the extension (it sends the page to the app that is already open).

The extension only reads the page URL to decide what to import — it does not scrape page text in the browser.

### Install on Chrome, Brave, or Edge (macOS, Linux, Windows)

These steps are the same on all three operating systems; only the browser’s extensions page address differs slightly.

1. Download `ljb-browser-extension-chromium-<version>.zip` from the release page.
2. Unzip it. You should get a folder named `ljb-browser-extension-chromium-<version>` containing `manifest.json`, `popup.html`, and other files.
3. Open your browser’s extensions page:
  - **Chrome:** `chrome://extensions`
  - **Brave:** `brave://extensions`
  - **Edge:** `edge://extensions`
4. Turn on **Developer mode** (toggle usually in the top-right corner).
5. Click **Load unpacked** (Chrome/Brave) or **Load unpacked extension** (Edge).
6. Select the **unzipped folder** from step 2 (the folder that contains `manifest.json`, not the zip file itself).
7. Pin the **LJB corpus import** icon to the toolbar if you like (puzzle-piece menu → pin).

After an LJB upgrade, download the matching extension zip from the new release and repeat steps 1–6 (you can remove the old unpacked copy from the extensions page first, or load the new folder alongside it and remove the old one).

### Install on Firefox (macOS, Linux, Windows)

Firefox does not use the Chromium zip. Use the Firefox asset from the same release.

1. Download `ljb-browser-extension-firefox-<version>.zip` and unzip it.
2. Launch **Le Jean-Baptiste** once if you have not already (see above).
3. Open `about:debugging#/runtime/this-firefox` in Firefox.
4. Click **Load Temporary Add-on…**
5. Open the unzipped folder and choose `manifest.json` inside it.

This is a **temporary** add-on: Firefox removes it when you quit the browser. Repeat step 3–5 after each Firefox restart, or keep using **File → Import from URL…** in LJB without the extension.

For a permanent Firefox install you would need a signed package from Mozilla (not distributed on the LJB release page today). Developer-focused build notes live in [apps/browser-extension/README.md](apps/browser-extension/README.md).

### Using the extension

1. Open LJB and your project.
2. In the browser, go to a supported page:
  - **Wikisource** — a chapter or work page on `*.wikisource.org`
  - **Kanripo** — a text URL with a `#KR…` fragment (juan or work)
  - **BDRC** — an etext reader on `library.bdrc.io` with `openEtext=bdr:VE…` in the URL
3. Click the **LJB corpus import** toolbar button, then **Import**.

LJB should receive the import dialog for that source. More detail on what each source sends: [docs/wikisource-import.md](docs/wikisource-import.md) (Wikisource), [docs/kanripo-import-plugin-planning.md](docs/kanripo-import-plugin-planning.md) (Kanripo), [docs/bdrc-import-planning.md](docs/bdrc-import-planning.md) (BDRC).

### Troubleshooting


| Problem                                           | What to try                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Import** does nothing or says it cannot connect | Quit and reopen LJB so the native host is registered again. Confirm LJB is running before you click Import.                                                                                                              |
| Extension missing after browser update            | Reload the unpacked folder (Chromium) or load the temporary add-on again (Firefox).                                                                                                                                      |
| Wrong or empty import                             | Check the URL matches the supported patterns above; use **File → Import from URL…** in LJB with the same link to compare.                                                                                                |
| SmartScreen or security warning                   | The extension is not from a store; you install it manually from the LJB release. Only download zips from [github.com/lejeanbaptiste/lejeanbaptiste/releases](https://github.com/lejeanbaptiste/lejeanbaptiste/releases). |




## Entity database — cloud backup and multi-machine sync

Le Jean-Baptiste keeps the live `entities.sqlite` on **local disk** on every
machine. Cloud services are optional and aimed at **type C** users (advanced
backup + sync):


| Piece                    | What it does                                                                       | Setup doc                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **R2 cloud backup**      | Compressed snapshots on a timer and on quit; restore after corruption or data loss | [entity-db-cloud-backup-setup.md](docs/entity-db-cloud-backup-setup.md)   |
| **D1 cross-device sync** | Row-level two-way entity sync between your machines                                | [entity-db-multi-machine-setup.md](docs/entity-db-multi-machine-setup.md) |


**Do not** put `entities.sqlite` in Dropbox, iCloud, or Nextcloud — that
corrupts SQLite. A lone `achievements.json` in a synced folder is usually fine,
but the default is to keep it next to the entity database; see the multi-machine
guide for type A / B / C and second-device onboarding.

Implementation planning: [entity-sync-planning.md](docs/entity-sync-planning.md).

## Build From Source

See [apps/desktop/README.md](apps/desktop/README.md) for the compilation and packaging instructions.

### Future

- [ ] `createCompoundAnchor` (`packages/cwrc-leafwriter/src/autoTagging/anchor.ts:247-248`) computes `localEnd` — the search-index equivalent of `localStart`, which the sibling `createAnchor` function's `rawRange` helper (same file) uses to convert a search-index back to a snapped raw text-node offset — but then never uses it: `endOffset: endRaw` (line 275) returns the *raw, unsnapped* input instead of the computed-and-normalized value, unlike `offset: startSearch.map[localStart]` a few lines above it, which does apply that snapping for the start boundary. `localEnd` is assigned and read nowhere. This looks like an incomplete port of the pattern `createAnchor`/`rawRange` establish elsewhere in the file, not a deliberate choice — but the existing test (`apply.test.ts:72`) exercises exactly the case where `endRaw` equals the node's full length, where `localEnd`'s `findIndex` would miss (hit the `-1` fallback) and `endRaw` happens to already be correct, so the gap may not be as visible as it should be. This only affects `createCompoundAnchor`'s callers (the post-component person-wrapper pass) and only when the end boundary isn't at a node's natural end, where whitespace-policy snapping could shift the offset. **2026-08-24: low real-world priority** — Asian-script sources normally carry no whitespace, so the whitespace-policy snapping this gap would affect essentially doesn't come up in practice for this project's actual corpus. Still worth fixing for correctness/robustness, but not urgent.
- [ ] Figure out how to accommodate both segmented and unsegmented Tibetan texts.

- Full CBETA integration
  - [ ] Include Bingenheimer's tagged bios



### 'LJBtero' (After testing)

- [ ] Clean up and rationalise options, UI, document and global settings. (Settings dialog reorganised into sections — `authorities`, `editor`, `entity-lookups`, `guardrails`, `markup-panel`, `profile`, `ui`, `reset` — and shipped in beta.2. Still open: the document-level vs global split; everything today is global.)
- [ ] Figure out how best to handle the insertion of entities NOT in said paragraph.
- [ ] Keyboard shortcut for insert entity
- [ ] Rationalise Word and LibreOffice plugins.
- [ ] Live passage citations in Word / LibreOffice: insert a refreshable field (source unit + optional translation + bibl + nearest page cue) that Syncs from LJB like Zotero — pointers only, no second copy of the edition ([live-passage-citation-planning.md](docs/live-passage-citation-planning.md))



### Database viewer

- [ ] Think about how to organise for rapid data entry
- [ ] Filters beyond entity kind (the kind filter ships and persists via `databaseViewPrefs`; no field-level or faceted filtering yet)



#### UX

- [ ] Find/replace Phase 2b: WYSIWYG visible-text replace across markup ([find-replace-planning.md](docs/find-replace-planning.md))
- [ ] Persist last find query across sessions (match-case / ignore-case and regex toggles already ship; the query itself resets to `''` on mount)
- [ ] Milestone-aware auto-tagging — [autotagging-milestone-projection-planning.md](docs/autotagging-milestone-projection-planning.md); **Phases A–E done** (enable in Settings → Interface → Behaviour); Phase D (AI/Sanmiao) deferred
- [ ] Re-explore Tag-boundary Bugs B/C/H (typing/delete at edges) keeping us from full Oxygen parity.



#### Dates

- [ ] Allow the setting and display of Sanmiao-style CJK dates in the place of/parallel to Western dates.
- [ ] Scan DILA for markers into Sanmiao
- [ ] AI assist for Sanmiao to identify beginning of dynasties, reigns, era



#### AI

- [ ] Noble titles
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
- [ ] Multi-machine soak and hardening ([entity-sync-planning.md](docs/entity-sync-planning.md) — Phase 0–4 shipped; achievements blob sync + Phase 5 hardening open)
- [ ] Entity DB cloud backup: on-launch "restore from cloud" dialog when `checkEntityDbIntegrity` fails (currently only an in-panel alert)
- [ ] Entity DB cloud backup: live R2 smoke test against a provisioned bucket + token
- [ ] Entity DB cloud backup: confirm Electron `safeStorage` is available on a packaged Linux build (needs an unlocked keyring)
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