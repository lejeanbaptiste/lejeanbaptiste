# Beta Plan

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

## First Step

Prove the packaged executable matches the dev build for the main workflow.

### Checklist

- Build the desktop app from a clean tree.
- Launch the packaged app, not only the dev shell.
- Open a real project folder.
- Edit a file and save it.
- Reopen the app and confirm the change persisted.
- Verify bundled resources load correctly in the packaged environment.
- Record any packaging-only failures as beta blockers.

## Work Plan

### Step 1: Packaging smoke test

Goal: confirm the alpha/beta packaging path is real and repeatable.

Deliverables:

- A successful packaged build command.
- A short list of packaging-specific bugs, if any.
- A known-good launch and save/reopen workflow.

Current status:

- `npm run build -w le-jean-baptiste-desktop` succeeds.
- `npm run package -w le-jean-baptiste-desktop` currently fails because Electron is not installed in the local workspace, so Electron Builder cannot resolve the Electron version.
- The next action is to restore the desktop app dependencies and rerun the package smoke test.

### Step 2: Blocker cleanup

Goal: fix anything that prevents startup, editing, saving, or reopening.

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

- macOS is the first release target.
- Linux and Windows packaging can follow after macOS is stable.
- Dev build testing is valuable, but packaged testing is the final gate.
