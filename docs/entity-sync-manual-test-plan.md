# Entity sync manual test plan

**Status:** Ready to run (2026-07-23)
**Purpose:** a checklist for testing the CEDB↔PEDB sync work in the real desktop
app by hand — the automated suite (`entitySync.smoke.test.ts` and the ~30 unit
test files under `packages/cwrc-leafwriter/src/autoTagging/`) already proves the
underlying logic; this plan is for the parts only the running app can show you:
dialogs, timing, and whether it *feels* right.
**Companion docs:** [`dual-entity-database-planning.md`](dual-entity-database-planning.md) (§ Implementation status has the full module map), [`entity-registry-merges-and-splits.md`](entity-registry-merges-and-splits.md)

---

## Before you start

You do **not** need two physical computers. "Machine A" and "Machine B" below
are just two different project folders on your one computer, both pointed at
the same central entity database folder (App Settings → entity database
folder). That's exactly what the sync code sees as "two machines" — it has no
idea whether the two folders are really on different hardware.

1. Build/launch the desktop app.
2. In App Settings, note (or set) your **central entity database folder** —
   call this `~/ljb-central-test/` for this run. Use a scratch folder, not your
   real one, so you can delete it afterward.
3. Create **two separate project folders**, e.g. `~/test-proj-a/` and
   `~/test-proj-b/`, each with a couple of TEI chapter files containing the
   same person mentioned by name (any name is fine — pick something you'll
   recognize, like "Zhang Heng" 張衡).
4. Open Project A first. Tag "Zhang Heng" as a new entity in the sidebar
   database tab. Then open Project B and tag the *same* name as a **second,
   separate** entity — you now have an intentional duplicate, one entity per
   project, both linked to the same central database.

Keep a Finder/Explorer window open on `~/ljb-central-test/` throughout — you'll
be peeking at `entities.xml`, `entity-orders.jsonl`, and
`entity-projects.json` as you go.

---

## Scenario 1 — A merge writes a durable order

**What this checks:** merging two entities doesn't just rewrite corpus keys —
it also leaves a permanent record.

1. With Project A open, go to the database sidebar tab.
2. Select both "Zhang Heng" entities, click Merge, confirm.
3. **Check:** `~/ljb-central-test/entity-orders.jsonl` now exists and has one
   new line (open it in any text editor — it's one JSON object per line).
4. **Check:** the chapter files in Project A that mentioned the dropped entity
   now show the surviving entity's id in their `key="…"` attribute.

If the file doesn't appear or has no new line, stop here — nothing else in this
plan will work.

---

## Scenario 2 — The actual bug fix: Machine B converges without being open

**What this checks:** the core reason this work exists. Before the redesign, a
merge made while another project's folder wasn't open would silently miss it
forever. This scenario proves that no longer happens.

1. Undo Scenario 1 if you already ran it (or just note the current state), and
   make sure the duplicate exists again in both projects — recreate one if
   needed and re-check its central-side id in the sidebar.
2. **Close Project B entirely** (or just don't open it — the key thing is it
   must not be the currently-open project).
3. With Project A open, merge the duplicate again (Scenario 1's steps).
4. **Check:** Project A's chapter files updated (as before).
5. **Check `~/test-proj-b/`'s chapter files directly on disk** (not through the
   app — just open them in a text editor): they should **still show the old,
   now-dead id**. This is expected and correct at this point — Project B hasn't
   had a chance to catch up yet.
6. **Now open Project B in the app.**
7. **Check:** Project B's chapter files should now show the *surviving* id —
   the dead id is gone, and you never touched Project B's database or files by
   hand. Look at the console/dev tools log for a line starting
   `[entity-orders] applied …` confirming the replay happened.
8. **Close and reopen Project B a second time.** The log line should *not*
   reappear (or should show 0 orders applied) — the app remembers it already
   caught up.

This is the scenario to show anyone skeptical that the redesign works: step 5
proves the old failure mode still exists in principle (an unreachable checkout
starts out stale), and step 7 proves it now heals itself.

---

## Scenario 3 — Bridge inbox (Promote / Link / Sync)

**What this checks:** the new dialog that links a project's entities into your
personal central-database index.

1. Open a project whose entity database is **project-local**, not central
   (check Project Settings). If you don't have one, create a fresh project and
   leave its entity store as "project."
2. Tag a person in that project.
3. In the database sidebar tab, click the **Hub icon** in the toolbar (new —
   next to Refresh). The Bridge inbox dialog opens.
4. **Check:** it shows a count like "0 in sync · 0 to sync · 1 unlinked · 0
   conflicts · 0 broken."
5. Click **Promote**. **Check:** the count moves to "1 in sync," and if you
   open your central database folder's `entities.xml`, the person now appears
   there too, with a note (`<idno type="ljb-central" subtype="…">` inside the
   project's `entities.xml`, if you want to peek at the raw XML) linking the
   two.
6. Now edit that person's description **in the central database** (via the
   central-mode sidebar, or hand-edit `entities.xml` in your test central
   folder and reopen the project). Reopen the Bridge inbox.
7. **Check:** the entity now shows under "to sync," not "in sync." Click
   **Sync**. **Check:** the description now also appears on the project side.
8. **Optional — provoke a conflict:** set a birth year on the project side and
   a *different* birth year on the central side for the same linked person.
   Reopen the inbox — the entity should now appear under **Conflicts**, listing
   the disagreeing field, and Sync should skip it.

---

## Scenario 4 — Orphan sweep (the gentle prompt)

**What this checks:** the new safety net that replaces "purge every key in the
project" with a precise, classified warning.

1. Pick a project with a couple of tagged, resolved entities.
2. **Close the project.**
3. By hand, open its `entities.xml` (project-local, or the shared central one
   if that's what it uses) and **delete one `<person>` (or similar) element**
   entirely — simulating "the database was rolled back and this entity is
   gone." Save the file.
4. **Reopen the project in the app.**
5. **Check:** you should see a warning dialog — "Unresolved entity keys
   found" — with a count, **not** the old "purge everything" prompt. It should
   offer **Cancel** or **Strip orphan keys**.
6. Click **Cancel** first, verify the corpus files are untouched (the tag
   stays, the `key=` stays).
7. Reopen the project again (should re-prompt, since nothing changed), this
   time click **Strip orphan keys**. **Check:** only the specific dangling
   `key=` attribute you'd expect is gone from the chapter file — the tag itself
   (e.g. `<persName>`) remains, just without the id.
8. **Bonus — stray-file check:** copy a chapter file from a *different*
   project (one using a different central/project database) into this
   project's folder. Reopen. **Check:** the warning should mention that some
   file(s) "appear to belong to a different project database and were left
   untouched" — and that file's keys must NOT be stripped even if you click
   Strip.

---

## Scenario 5 — Time Machine, central tab, and order-log survival

**What this checks:** the new second history tab, and that rolling back the
central database doesn't erase the propagation record from Scenario 2.

1. Open Time Machine (however it's triggered in your build — menu or
   shortcut). **Check:** you now see two tabs, "Project" and "Entity
   database."
2. Switch to the **Entity database** tab. **Check:** it points at your central
   folder path, not the project folder.
3. Click **Back up now**. **Check:** a snapshot appears in the list.
4. Make a change to the central database (edit a name, add an entity) so
   there's something to lose.
5. Click **Restore** on the snapshot from step 3. Confirm through the warning
   dialog (it should mention that projects may show unresolved keys and to
   check sync prompts).
6. **Check:** the change from step 4 is gone (rollback worked).
7. **Check the important part:** open `entity-orders.jsonl` in your central
   folder — it should **still contain every order recorded before the
   restore**, including the one from Scenario 2, even though the rest of the
   database rolled back. If you made any *new* orders between the backup and
   the restore, those should still be present too (nothing is lost, only the
   entity records themselves rolled back).

---

## What's intentionally NOT covered yet

- **Fork-merge of two central database copies** (the Unison-style "two forked
  CEDBs" story) has a tested engine (`centralForkMerge.ts`) but **no menu entry
  point wired up yet** — there's nothing to click in the app for this one.
- New dialog copy is plain English, not yet run through the i18n/translation
  pipeline.
- Conflict resolution from the Bridge inbox is "go edit one of the two records
  yourself" — there's no in-dialog "pick a value" UI yet, just the list of what
  disagrees.

If you hit anything that doesn't match this plan, the first place to look is
whichever file this plan told you to inspect by hand (`entity-orders.jsonl`,
`entity-projects.json`, the entity's `entities.xml`) — most surprises will show
up there before they show up as a visible bug.
