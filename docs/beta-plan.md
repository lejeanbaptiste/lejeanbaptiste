# Beta Plan

**Status (2026-08-02):** The slow-machine startup race and Windows shutdown
issue have both passed packaged Windows testing. The remaining beta work is
release hygiene and one clean packaged regression pass, including the entity
sync scenarios below.

I am aiming for a beta of the current feature set by September 2026.

## Ship criteria

I will consider the beta ready when a new user can:

1. Install and launch the desktop app.
2. Open a local project.
3. Browse and edit XML.
4. Save changes safely.
5. Use the existing navigation and search features.
6. Quit and relaunch without losing work or hitting a startup failure.

## Scope

I am not adding new features for the beta unless they are needed to make an existing feature safe to ship. Unstable features need to be fixed or clearly gated.

## Remaining work

### Reliability blockers

- [x] Fix the intermittent startup race that leaves a loading window with no editor pane. It must not require `Ctrl+R` to recover.
- [x] Fix Windows shutdown so the application quits normally from the window controls and menu, without needing Task Manager. A short (about one-second) shutdown delay is acceptable.

### Release hygiene

- Settle versioning and release commands.
- Start the changelog from the next release.
- Keep the build and packaging instructions current in [apps/desktop/README.md](../apps/desktop/README.md).
- Use the [beta tester guide](beta-tester-guide.md) for packaged testing.
- Run the entity database/sync scenarios in
  [entity-sync-manual-test-plan.md](entity-sync-manual-test-plan.md) against
  scratch project folders before declaring the build ready.

### Final packaged regression

Before each release I will build from a clean tree, install the packaged app, and run the core workflow:

> Open a real project → edit → save → quit → relaunch → reopen.

I will also check bundled Python/Sanmiao, language assets and plugins, icons, updates, and the main entity/tagging workflows. The [smoke-test checklist](smoke_test.md) remains the more detailed regression reference.

Packaged builds are the final gate; development builds are useful during implementation but do not replace this pass.
