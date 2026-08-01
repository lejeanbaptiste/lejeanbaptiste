# Beta Plan

**Status (2026-08-01):** **In progress** — installers ship on macOS/Windows/Linux. Remaining for beta: blocker cleanup sign-off, release hygiene, packaged regression.

Target: a shippable beta for the current feature set by September 2026.

## Beta Definition

The beta is done when a new user can:

1. Install and launch the desktop app.
2. Open a local project folder.
3. Browse and edit XML files.
4. Save changes safely to disk.
5. Use the core navigation and search features already built.
6. Quit and relaunch without data loss or startup failure.

## Scope Rule

- Keep all already-built features in scope.
- Do not add new features unless they are required to ship the existing feature set safely.
- If a feature is unstable, either fix it or hide it behind a clear gate.

## Work Plan

### Step 1: Packaging smoke test — largely done

Goal: confirm the alpha/beta packaging path is real and repeatable.

**Current status (2026-08-01):** Installers ship for **macOS** (signed/notarized `.pkg`), **Windows** (NSIS), and **Linux** (`.deb`, APT repo, Flatpak). See root [readme.md](../readme.md) and [apps/desktop/README.md](../apps/desktop/README.md). Older notes about Electron missing from the local workspace are obsolete for release packaging.

Still worth repeating before each release:

- Build from a clean tree (`npm run build:desktop` / platform package scripts).
- Launch the **packaged** app, open a real project, edit, save, relaunch.
- Confirm bundled Python/Sanmiao, icons, and update checks behave in the packaged environment.

### Step 2: Blocker cleanup

Goal: fix anything that prevents startup, editing, saving, or reopening.

Recent reliability work (editor pane sometimes blank on startup; plugin enable without restart) belongs here until signed off on slow machines.

### Step 3: Release hygiene

Goal: make it easy to produce and share beta builds.

Includes:

- Versioning
- Basic release notes
- A repeatable build command
- Simple tester instructions

### Step 4: Regression pass

Goal: run the core workflow end to end one more time on the packaged build.

## Notes

- macOS was the first release target; Linux and Windows packaging now ship as well.
- Dev build testing is valuable, but packaged testing remains the final gate.
