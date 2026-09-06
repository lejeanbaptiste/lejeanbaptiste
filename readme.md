<img src=".github/splash.png" alt="Grognard — XML avec du corps" width="600">

Grognard is a desktop XML markup editor forked from the in-browser tool [LEAF-Writer](https://leaf-writer.leaf-vre.org/), part of [The Linked Editing Academic Framework](https://www.leaf-vre.org/) (LEAF) tool suite. LEAF-Writer is an enhancement of the CWRC-Writer developed by the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca), and was developed alongside the [Named Entity Recognition Vetting Environment](https://nerve.lincsproject.ca/en) (NERVE). The project website is [github.com/grognard/grognard](https://github.com/grognard/grognard). Grognard wraps the web app in Electron for offline, individual desktop use and includes workflow changes aimed particularly at local editing and East Asian documents.

AGPL-3.0 · [Commitizen friendly](http://commitizen.github.io/cz-cli/)

## License and attribution

This repository is licensed under `AGPL-3.0-only`, inherited from LEAF-Writer (whose `LICENSE` is the GNU Affero GPL v3). Third-party runtime components keep their own upstream licenses, including the heavily customized `TinyMCE` editor used by LEAF-Writer.

For a concise list of the major bundled components and where to verify their license terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

To cite Grognard, see [CITATION.cff](CITATION.cff) (GitHub's "Cite this repository" button reads it directly).

## Credits

- **[LEAF](https://www.leaf-vre.org/)** (The Linked Editing Academic Framework) — Grognard is a desktop fork of [LEAF-Writer](https://leaf-writer.leaf-vre.org/), itself an enhancement of CWRC-Writer from the [Canadian Writing Research Collaboratory (CWRC)](https://cwrc.ca).
- **[Sanmiao](https://github.com/PotatoSinology/sanmiao)** — Chinese, Japanese, and Korean historical calendar conversion by Daniel Patrick Morgan (CNRS-CRCAO), bundled as the desktop app's date-conversion back end. MIT licensed.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the rest of the bundled runtime components (TinyMCE, Font Awesome, Lato, etc.) and their license terms.

## Desktop paradigm

LEAF-Writer is designed for server deployment, connecting XML corpora via Git, which provides file versioning and easy group access for teams. The disadvantages of this model are that it requires internet access, running one's own server if one wants to use a modified version, and using Git for corpus sharing, backup, and versioning. It is also necessarily slower and clunkier when working with local files. Grognard is designed to work quickly and naturally with local files, with or without internet connection.

LEAF-Writer is also wired to connect to five authorities — VIAF, Wikidata, Getty, DBpedia, and GeoNames — to pull identifiers and data about the named entities therein. Grognard keeps that functionality and adds desktop-first local authority packs and entity databases for East Asian (and other) corpora.

## Overview

Grognard is a WYSIWYG XML editor built around a heavily customized [TinyMCE](https://www.tiny.cloud/) core (from LEAF-Writer), packaged as an Electron desktop app. This README focuses on the desktop fork. Planning notes and architecture docs live under [docs/](docs/README.md).

## What is built

Grognard is the desktop, offline-first fork of LEAF-Writer. The current build already supports:

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

Download the installer for your platform from the [latest release](https://github.com/grognard/grognard/releases/latest). All release assets can be verified as described in [SECURITY.md](SECURITY.md).

### macOS

1. Download the `.pkg` for your machine: `arm64` (Apple silicon) or `x64` (Intel).
2. Open the `.pkg` file and follow the installer. The packages are signed and notarized, so Gatekeeper accepts them without warnings.
3. The application will be installed to `/Applications/Grognard.app`.
4. Signed updates are checked automatically when the application starts and every four hours. A downloaded update is installed when the application quits. The `.pkg` is only needed for the first installation.

### Windows

1. Download the installer for your machine: `arm64` for Windows on Arm or `x64` for Intel/AMD (`Grognard-win-Setup-<version>-<arch>.exe`).
2. Run the installer and follow the prompts. Choose your installation directory and start-menu shortcut preferences.
3. **Note:** The installer is not signed by a certificate authority. Windows Defender SmartScreen may show a warning. To proceed, click "More info" → "Run anyway". A signed package through the Microsoft Store is planned.
4. Updates are checked automatically when the application starts and every four hours. A downloaded update is installed when the application quits.

### Linux

**APT repository (Debian/Ubuntu, amd64 and arm64) — recommended, updates automatically:**

```bash
# Add the repository signing key
wget -qO- https://grognard.github.io/grognard/apt/grognard-archive-key.asc \
  | sudo tee /usr/share/keyrings/grognard.asc > /dev/null

# Add the repository to your sources
echo "deb [signed-by=/usr/share/keyrings/grognard.asc] https://grognard.github.io/grognard/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/grognard.list > /dev/null

# Install and keep updated
sudo apt update
sudo apt install grognard-desktop
```

**Standalone .deb (Debian/Ubuntu):**

1. Download `Grognard-linux-<version>-amd64.deb` (or `-arm64.deb`).
2. Install with your package manager: `sudo apt install ./Grognard-linux-<version>-amd64.deb`

The `.deb` also adds the apt repository above (signing key to
`/usr/share/keyrings/grognard.asc`, source to
`/etc/apt/sources.list.d/grognard.list`) so `sudo apt upgrade` keeps the app up
to date — this is the only update channel on Linux, as the in-app updater is
macOS/Windows only. To opt out, create `/etc/default/grognard` containing
`repo_add_once="false"` before installing, or just delete the `.list` file
afterwards. `apt purge grognard-desktop` removes both files.

**Flatpak (x86_64):**

1. Download `Grognard-linux-flatpak-<version>-x86_64.flatpak`.
2. Install with: `flatpak install ./Grognard-linux-flatpak-<version>-x86_64.flatpak`

For detailed build and packaging information, see [apps/desktop/README.md](apps/desktop/README.md).

## Browser extension (corpus import)

The **Grognard corpus import** browser extension lets you send the current **Wikisource**, **Kanripo**, or **BDRC** page straight to Grognard with one click. It is optional: you can always import the same sources from inside Grognard with **File → Import from URL…** (paste the page address). The extension is only a shortcut from the browser toolbar.

Extension zips are attached to the **same [GitHub release](https://github.com/grognard/grognard/releases/latest)** as the desktop installers — look for:

- `grognard-browser-extension-chromium-<version>.zip` — Chrome, Brave, Edge, and other Chromium browsers
- `grognard-browser-extension-firefox-<version>.zip` — Firefox

Use the zips from the release that matches your installed Grognard version (for example, if you installed `v0.1.0-beta.6`, download the extension zips whose names end in `0.1.0-beta.6`).

### Before you install the extension

1. **Install Grognard** (see [Install](#install) above).
2. **Launch Grognard at least once** before loading the extension. On first start the app registers a _native-messaging host_ on your machine so the browser can talk to the running editor. If you skip this step, the extension icon may appear but **Import** will not reach Grognard.
3. **Keep Grognard running** when you use the extension (it sends the page to the app that is already open).

The extension only reads the page URL to decide what to import — it does not scrape page text in the browser.

### Install on Chrome, Brave, or Edge (macOS, Linux, Windows)

These steps are the same on all three operating systems; only the browser’s extensions page address differs slightly.

1. Download `grognard-browser-extension-chromium-<version>.zip` from the release page.
2. Unzip it. You should get a folder named `grognard-browser-extension-chromium-<version>` containing `manifest.json`, `popup.html`, and other files.
3. Open your browser’s extensions page:

- **Chrome:** `chrome://extensions`
- **Brave:** `brave://extensions`
- **Edge:** `edge://extensions`

1. Turn on **Developer mode** (toggle usually in the top-right corner).
2. Click **Load unpacked** (Chrome/Brave) or **Load unpacked extension** (Edge).
3. Select the **unzipped folder** from step 2 (the folder that contains `manifest.json`, not the zip file itself).
4. Pin the **Grognard corpus import** icon to the toolbar if you like (puzzle-piece menu → pin).

After an Grognard upgrade, download the matching extension zip from the new release and repeat steps 1–6 (you can remove the old unpacked copy from the extensions page first, or load the new folder alongside it and remove the old one).

### Install on Firefox (macOS, Linux, Windows)

Firefox does not use the Chromium zip. Use the Firefox asset from the same release.

1. Download `grognard-browser-extension-firefox-<version>.zip` and unzip it.
2. Launch **Grognard** once if you have not already (see above).
3. Open `about:debugging#/runtime/this-firefox` in Firefox.
4. Click **Load Temporary Add-on…**
5. Open the unzipped folder and choose `manifest.json` inside it.

This is a **temporary** add-on: Firefox removes it when you quit the browser. Repeat step 3–5 after each Firefox restart, or keep using **File → Import from URL…** in Grognard without the extension.

For a permanent Firefox install you would need a signed package from Mozilla (not distributed on the Grognard release page today). Developer-focused build notes live in [apps/browser-extension/README.md](apps/browser-extension/README.md).

### Using the extension

1. Open Grognard and your project.
2. In the browser, go to a supported page:

- **Wikisource** — a chapter or work page on `*.wikisource.org`
- **Kanripo** — a text URL with a `#KR…` fragment (juan or work)
- **BDRC** — an etext reader on `library.bdrc.io` with `openEtext=bdr:VE…` in the URL

1. Click the **Grognard corpus import** toolbar button, then **Import**.

Grognard should receive the import dialog for that source. More detail on what each source sends: [docs/wikisource-import.md](docs/wikisource-import.md) (Wikisource), [docs/kanripo-import-plugin-planning.md](docs/kanripo-import-plugin-planning.md) (Kanripo), [docs/bdrc-import-planning.md](docs/bdrc-import-planning.md) (BDRC).

### Troubleshooting

| Problem                                           | What to try                                                                                                                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import** does nothing or says it cannot connect | Quit and reopen Grognard so the native host is registered again. Confirm Grognard is running before you click Import.                                                                                 |
| Extension missing after browser update            | Reload the unpacked folder (Chromium) or load the temporary add-on again (Firefox).                                                                                                                   |
| Wrong or empty import                             | Check the URL matches the supported patterns above; use **File → Import from URL…** in Grognard with the same link to compare.                                                                        |
| SmartScreen or security warning                   | The extension is not from a store; you install it manually from the Grognard release. Only download zips from [github.com/grognard/grognard/releases](https://github.com/grognard/grognard/releases). |

## Entity database — cloud backup and multi-machine sync

Grognard keeps the live `entities.sqlite` on **local disk** on every
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
