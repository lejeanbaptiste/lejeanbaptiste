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
2. **Launch LJB at least once** before loading the extension. On first start the app registers a _native-messaging host_ on your machine so the browser can talk to the running editor. If you skip this step, the extension icon may appear but **Import** will not reach LJB.
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

1. Turn on **Developer mode** (toggle usually in the top-right corner).
2. Click **Load unpacked** (Chrome/Brave) or **Load unpacked extension** (Edge).
3. Select the **unzipped folder** from step 2 (the folder that contains `manifest.json`, not the zip file itself).
4. Pin the **LJB corpus import** icon to the toolbar if you like (puzzle-piece menu → pin).

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

1. Click the **LJB corpus import** toolbar button, then **Import**.

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
