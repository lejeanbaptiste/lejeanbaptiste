# Beta Tester Guide

This guide covers the practical checks for a packaged beta build of Grognard. It is intended for testers who are not building the application from source.

Use a clean test project where possible. Record the application version, operating system and architecture, project type, and approximate document size. If a check fails, record the exact steps that led to the failure and attach logs or screenshots.

## Core reliability

- [ ] Install the correct packaged build for the operating system and architecture.
- [ ] Launch the application reliably without a frozen blank window or a need to refresh with `Ctrl+R`.
- [ ] Open an existing project.
- [ ] Create a new project/root directory with an entities database.
- [ ] Reopen a project containing an entities database.
- [ ] Install language assets and plugins, where applicable.
- [ ] Edit and save XML.
- [ ] Quit from both the window controls and application menu; on Windows, this must not require Task Manager.
- [ ] Relaunch the application.
- [ ] Reopen the project and verify that edits, entities, and settings persist.
- [ ] Confirm that there are no broken images or icons.

## Entities and dates

- [ ] Add a linked entity through the Attributes panel's **Lookup** function.
- [ ] Confirm that the entity can be written to the intended local or central database.
- [ ] Run Chinese Sanmiao date conversion successfully.
- [ ] Run Japanese Sanmiao date conversion successfully.
- [ ] Confirm that there are no missing-Python-package or alias-resolution errors.

## Editing and validation

- [ ] Lock and unlock text entry using the editor lock button.
- [ ] Apply a large batch of automatic tags without freezing or crashing.
- [ ] Confirm that newly created documents do not produce unexpected schema violations.
- [ ] Confirm that heavily tagged documents do not produce unexpected schema violations.
- [ ] Open and navigate the Entities and Markup Tree panels without obvious stalls.
- [ ] Open items in the Disambiguation panel with only a brief, acceptable delay.

## Auto-tagging quality

- [ ] Confirm that auto-tag suggestions are relevant.
- [ ] Confirm that suggestions do not contain systematic one-character words.
- [ ] Record representative false positives and false negatives for later review.

## Reporting

- [ ] Report the operating system and architecture.
- [ ] Report the application version.
- [ ] Report the project type and approximate document size.
- [ ] Record exact reproduction steps for failures.
- [ ] Attach logs and screenshots where useful.

For exhaustive internal regression coverage, use the [manual smoke checklist](smoke_test.md) and the relevant feature-specific test plans.
