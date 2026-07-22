# Entity registry, merges, and splits — a plain-language explainer

**Audience:** planning / product thinking (not an implementation checklist)  
**Status:** Explainer (2026-07-22)  
**Companion to:** [`dual-entity-database-planning.md`](dual-entity-database-planning.md), [`Auto-tagging.md`](Auto-tagging.md), [`versioning-planning.md`](versioning-planning.md)

This note is for thinking through a hard corner of the design: when you tell the software “these two people are the same” (or “this one person is really two”), what has to stay consistent — and what breaks today when projects move, machines differ, or the address book is wrong.

---

## The cast of characters

Imagine you are editing classical Chinese texts and building a personal index of people.

| Thing | Everyday meaning |
|-------|------------------|
| **Corpus** | Your TEI texts (`chapter1.xml`, …). Mentions of people carry a small label `@key="…"`. |
| **Entity database** (`entities.xml`) | Your card catalogue: one card per person/place/…, each with an id. |
| **`@key`** | The sticky note on a mention that says “this stretch of text is *that* catalogue card.” |
| **Merge (Absorb)** | “Oops — I made two cards for 張衡. Keep one card; point every sticky note at the survivor.” |
| **Split** | “Oops — I used one card for two different people both called 王弼. Pull them apart again.” |
| **Registry** (`entity-projects.json`) | An **address book** of edition folders that share this catalogue, so a merge knows which folders to walk when rewriting sticky notes. |

The registry is *not* the catalogue. It is only the list of places where sticky notes might live.

---

## Why an address book exists at all

Suppose your **central** catalogue is shared by two editions:

- `han-commentary/` — chapters already tagged with `key="person-000014"` for 張衡  
- `later-han-letters/` — other chapters, same catalogue, same `person-000014`

You discover a duplicate card `person-000088` that is also 張衡. You merge 088 into 014.

If the software only rewrote keys inside the folder you have open, the other edition would still say `person-000088` — a ghost pointing at a deleted card. The address book exists so the rewrite can visit **every** edition that checked in as using this catalogue.

Under the **dual-database** plan, the painful cross-folder case shrinks for collaboration (each edition has its own project catalogue). It does **not** disappear for *you* personally: Absorb inside one project still rewrites that project’s texts, and Absorb inside your central catalogue still needs to know which of *your* projects care — if central merges ever rewrite anything (today they do, via the registry; in the dual model, central Absorb should mostly update mappings, not corpus keys — see below). The address book problem remains wherever one catalogue fans out to many folders.

---

## Part 1 — Registry fragility

### What goes wrong in one sentence

The address book currently stores **absolute paths** (“`/Users/daniel/editions/han-commentary`”). When you open a project, the app also **throws away** any address it cannot see on *this* machine. That “cleanup” helps when you delete a folder for real — and quietly destroys the roaming / two-machine story.

### Story A — Laptop and desktop, same Dropbox brain

1. On the **laptop**, you open `han-commentary`. The address book records  
   `/Users/daniel/Dropbox/editions/han-commentary`.
2. On the **desktop** (Windows), you open the same project from  
   `D:\Dropbox\editions\han-commentary`.  
   The app looks for the Mac path, doesn’t find it, **deletes** that entry, and writes only the Windows path.
3. Back on the laptop, without reopening every project, you merge two people in the shared catalogue.  
   The rewrite walks whatever the address book still lists. Depending on who last touched the synced address book, **one machine’s checkout may be missing** from the walk.
4. Result: some chapters updated, some still wearing the dead id. Nothing looks “broken” until a later open or a fingerprint warning.

This is not exotic. It is the normal “I work at home and at the office” pattern the dual-database plan assumes.

### Story B — You renamed or moved a folder

You reorganize: `~/editions/han-commentary` → `~/research/2026/han-commentary`.

Until you open the project again from the new place, the address book still points at the old path (or has pruned it as missing). A merge run from *another* project that shares the catalogue will **skip** the moved tree. Sticky notes there stay wrong.

### Story C — Git clone on a second computer

You clone the edition repo fresh. The catalogue may live elsewhere (central folder in cloud). The clone has never “checked in” to the address book on this machine. A merge performed from your *other* edition will not know this clone exists until you open it once against that catalogue.

Clones do **not** carry the central address book inside the Git repo (it sits beside the central `entities.xml`). So “I pulled the texts” ≠ “the catalogue knows about me.”

### Story D — Dropbox has not finished downloading

A path is listed, but the folder is a cloud placeholder and `pathExists` fails. The app treats it as deleted and prunes it. Later the files appear — but the address book forgot them.

### Story E — Corrupt or half-synced address book

Two machines save `entity-projects.json` at once (cloud race). One wins; entries vanish. Or the file is truncated; the app treats it as empty and re-seeds from **only the project you just opened**. Other editions are forgotten until each is opened again.

### Story F — A project you never opened after creating the catalogue

You tagged everything in project A. Project B was linked to the same catalogue in settings but you never opened B on this machine. B is absent from the address book. Merge from A does not touch B.

### What “fixed” would feel like (non-technical)

Each edition already has (or should lean on) a **stable project id** that survives moving folders and changing OS paths — like a passport number for the edition, not a street address.

The address book should remember: “passport X last seen at these paths,” and **not** throw away passport X just because today’s computer cannot see yesterday’s street. Prune only when the user says “I deleted this edition,” or after a long confirmed absence — not on every open.

Until that change, **do not trust cross-project merge** in any multi-machine or heavily moved layout. Prefer: open the project whose texts you care about, merge there, or use Time Machine / Git if something looks half-updated.

---

## Part 2 — Merges (Absorb): what actually happens

When you merge card B into card A:

1. **Catalogue:** names, authority ids (CBDB, Wikidata, …), and some notes are unioned onto A; B is deleted.
2. **Sticky notes:** every `@key="B"` the software can find in registered edition folders becomes `@key="A"`.
3. You get a short report: how many keys changed, how many files, which folders, any errors.

### Happy path

Two cards, same CBDB id, same person. Merge. All chapters in registered folders now point at A. Your personal index and the texts agree.

### Edge case — Wrong merge (false friend)

Two people share a surname and you merge them by mistake.

- Authorities may now sit on one card (mixed CBDB + wrong Wikidata).
- Sticky notes in many files all say A.
- **There is no automatic un-merge.** Split is not implemented (see Part 3).
- Recovery today: Time Machine / Git restore of `entities.xml` *and* of every corpus file that was rewritten — or painful hand re-tagging.

Moral: merge is easy to click and expensive to undo. The UI should feel like a librarian’s stamp, not a casual tidy-up.

### Edge case — Merge across kinds

Person into place is refused. Good. No story there — just don’t expect the tool to “fix” a bad typology.

### Edge case — Open, unsaved tabs

Rewrite happens on **disk**. An editor tab that still has the old file in memory can save later and **write the dead id back**. Delete/merge flows already warn to save first; ignore that warning and you can resurrect ghosts.

### Edge case — Only some folders updated

Registry incomplete (Part 1) → report says “12 files updated” while another edition still has B. Later, fingerprint or “unknown key” symptoms appear only in the missed edition.

### Edge case — Purge vs merge scope (easy to confuse)

| Action | What it touches today |
|--------|------------------------|
| **Merge / delete entity** | Catalogue + sticky notes in **all registered** edition folders that still exist on this machine |
| **Purge keys** (database mismatch dialog) | Sticky notes in **this project only**; does not fix other editions |

So “I purged” does not mean “I cleaned my whole research life.”

### Edge case — Import on mismatch is still a stub

If the project thinks it was built against catalogue X but you attached catalogue Y, the dialog offers Import. In the current app, Import is **not actually available** — you Cancel or Purge. Planning docs describe a full import+remap; until that ships, mismatch recovery is harsher than the labels suggest.

### Dual-database twist — two different merges

Under the dual plan, keep these mentally separate:

| Where you merge | What should move |
|-----------------|------------------|
| **Project catalogue** (edition) | Union cards; rewrite `@key` in **this edition’s** texts (and only those). Collaborators all see the same Absorb. |
| **Central catalogue** (personal) | Union *your* cards; update **mappings** (`ljb-central`) on project cards if needed. Corpus `@key`s should **not** flip to central ids. |

If central Absorb still walked the old registry and rewrote corpus keys, you would break collaborators’ editions. The bridge plan’s Absorb verb must respect that boundary.

### Dual-database twist — mappings after Absorb

Project cards may carry `<idno type="ljb-central">` for you (and for colleagues). If you Absorb project B into A:

- Sticky notes B→A (corpus).
- Mapping rows on B must move onto A (or be re-linked).
- If you and a colleague both had mappings on B, both need to survive on A (two `ljb-central` rows with different subtypes).

If you Absorb in **central** only: project texts unchanged; your mapping may now point at the surviving central id — or become stale if the mapping still names the deleted central id. The “bridge inbox” idea exists for that staleness.

---

## Part 3 — Splits: the missing operation

### What users mean by split

“I treated 王弼 the commentator and 王弼 someone else as one card. Some passages are one person, some the other. Pull them apart.”

That is not the opposite of merge in a mechanical sense. Merge is many→one with a single rewrite rule. Split is one→many with a **judgment per mention** (or per document, or per chapter).

### What the app does today

There is a menu entry that explains: there is **no automatic split**. Practical workaround:

1. Note which passages are which person (or export a list).
2. Delete the overloaded card **or** strip keys (tags remain; identity cleared).
3. Create two (or more) new cards.
4. Re-link or re-disambiguate mentions onto the right cards.

That is scholarly work. The software can help with queues and filters; it cannot know which 王弼 is which without you.

### Why automatic split is hard (examples)

**Example 1 — No signal in the text**  
Half the mentions are bare `王弼` with no title, no date, no office. Even a human needs context outside the span. An automatic 50/50 split would be vandalism.

**Example 2 — Authority made it worse**  
One card has two CBDB ids because of an earlier bad merge. Split must decide which mentions keep which authority — again, per mention.

**Example 3 — Partial split**  
Only *some* keys were wrong. You want “these twelve hits → new card; the rest stay.” That is a **bulk retarget** tool (select mentions → assign other entity), not a catalogue “split button.”

**Example 4 — After collaboration**  
Colleague already built analysis on `person-UUID-A`. You split A into A and C locally; their checkout still has only A until they pull. Split is a shared-edition event; it needs the same discipline as Absorb (one writer, then sync).

**Example 5 — Central vs project**  
Splitting a **central** card does not automatically split project cards that mapped to it. You may need: split central → then on each linked project, Absorb/Link cleanup or a guided “this mapping is ambiguous.”

### A kinder product shape than “Split entity…”

Think in verbs scholars already understand:

1. **Find mentions of this card** (concordance).
2. **Move selected mentions to another card** (existing or new).
3. **Optional:** if the old card has zero mentions left and you confirm, delete it.

That *is* split, done as a workflow, without pretending one click can reverse a merge.

Time Machine remains the safety net when the mistake was a bad Absorb five minutes ago and you have not synced chaos to a colleague yet.

---

## Part 4 — Edge-case matrix (quick reference)

| Situation | Likely symptom | What helps |
|-----------|----------------|------------|
| Two machines, pruned address book | Some editions keep dead `@key`s after merge | Id-based registry; reopen all editions before Absorb; check merge report folder list |
| Moved/renamed project | Same | Open from new path before merging elsewhere |
| Fresh Git clone never opened | Same | Open once against the catalogue |
| Cloud placeholder pruned | Same | Wait for sync; reopen |
| Bad merge | Mixed authorities; wrong person in many files | Restore snapshots of catalogue **and** texts; avoid casual Absorb |
| Unsaved tabs | Dead ids return on save | Save all before merge/delete |
| Purge on mismatch | Only this project’s keys cleared | Expect other editions untouched |
| Want split | Menu only explains | Concordance + move mentions + new cards |
| Central Absorb in dual model | Risk of rewriting shared `@key`s if naïve | Absorb-in-central updates personal index/mappings only |
| Project Absorb | Collaborators need the new `entities.xml` + remapped texts | Treat as edition release; sync whole project folder |

---

## Part 5 — Design morals (for the dual-database plan)

1. **Fix the address book before trusting Absorb across a scholarly life.** Passport ids, not street addresses; don’t prune what you merely cannot see today.
2. **Prefer edition-local Absorb** (project catalogue) for anything that rewrites `@key`. That matches collaboration (“we share this `entities.xml`”) and shrinks the blast radius.
3. **Central Absorb is a personal tidy** — authorities and your own cards — not a silent rewrite of shared editions.
4. **Merge is privileged; undo is restore or re-tag.** Invest in confirmations, authority-duplicate suggestions, and clear reports (“will touch N files in M folders: …”).
5. **Don’t ship a fake Split.** Ship “mentions of this entity” + “retarget selection” + delete-if-orphan.
6. **Registry, catalogue, and corpus are three timelines.** Rolling back one without checking the others recreates ghosts (see dual-plan rollback orphan scans).
7. **Teach the failure mode.** Workshop copy: “Before merging people in a shared catalogue, open each edition on this computer once” — until the passport-style registry exists; afterward: “Review the folder list in the merge confirmation.”

---

## Glossary (sticky-note version)

- **Registry / address book** — which edition folders share this catalogue for key rewrite.  
- **Fingerprint** — UUID inside `entities.xml` so a project can tell it was attached to a different catalogue.  
- **Remap** — bulk find-and-replace of `@key` values after merge/delete.  
- **Absorb** — planned name for “merge cards” once Link/Promote exist beside it.  
- **Link / Promote** — connect project card ↔ personal card **without** rewriting corpus keys.

---

## Related reading

- Dual store + bridge: [`dual-entity-database-planning.md`](dual-entity-database-planning.md) (section “Registry fragility”)  
- Current catalogue rules: [`Auto-tagging.md`](Auto-tagging.md)  
- Local restore: [`versioning-planning.md`](versioning-planning.md)

---

# Reflections

First and foremost, is there not some pre-made solution to this? No one has solved this problem?

If it is to us to solve:

For basic infrastructure, the user will have a central entities database (CEDB) and a project entities database (PEDB). The PEDB is the most important, because it is what gives meaning to a corpus; the CEDB is mainly there to aggregate across projects, notably search strings and authorities concordances. 

This is what I think we need:

The central database should be the clear and first asset for tagging and disambiguation. We should have an icon for this to sit alongside Wikidata, etc,, and it should be included in the authorities options for autotagging. In disambiguating it should thus be impossible to not already know if there is an CEDB entry matching the string in question, or linked to an external authority one associates. 

The PEDB carries the same information as does the CEDB, plus a CEDB concordance. 
Both use UUID, starting with a letter
Each entity record will have a 'date of last modification' timestamp in it.
Each project file will have the project name and, maybe, a UUID of its PEDB coded to its metadata. That way, we can 'translate' from one project to another, but if we copy a file from one to another, it will not corrupt the other PEDB because we will know that it does not belong.
We will keep a registry (?) of timestamped CEDB merges and deletions.
Time Machine should have two tabs: archive and restore CEDB and archive and restore project (including PEDB).

# Simplest situation: the user works from a single computer.
We can use a CEDB alone, or we can read and write from both CEDB and PEDB at same time for very little difference of cost.

# Single user, multiple machines, with problems synching OR collaboration
Each CEDB has a UUID, and the PEDB keeps a concordance of each CEDB with which it is linked, and there is a translation layer between CEDB and PEDB. For ease of use, there should be no distinction between situations, where the user has to remember to change between CEDB and PEDB id systems; this will just be baked in.

At regular intervals (?), we will run a sync between CEDB and PEDB. Each entity record will have a 'date of last modification' timestamp in it – for the entity, not the whole database. 

- First, we do a sweep of the corpus. If the corps has PEDB ids not present in PEDB, those ids should be flushed from the XML. The user should get a warning, as this is a sign that something is f*ed up
- Next we compare entries between PEDB and CEDB
- if PEDB entry has CEDB id, check that CEDB id is present in CEDB or registry (?); 
  - if it is present, compare children
    - if children are identical (e.g., both have surname, given name, dates, and they are identical), then ignore and update the older one's timestamp;
    - if assets are different, then propagate the most recent to both (with most recent timestamp) ;
  - if not present in CEDB, 
  	- if it is in the registry as merged or deleted from CEDB, then the same should be done in the local project. The user should be warned, but the CEDB ids in PEDB will be updated with or without his say (he's the one that made that decision prior).
  	- if it is a wholly new CEDB UUID of which CEDB has no record (in case of CEDB rollback), then check for overlapping authority associations and prompt the user;
- if PEDB does not have CEDB id, save entry to CEDB

# Story A — Laptop and desktop, same Dropbox brain
If I understand correctly, the problem is that there is an entity id merge/purge that is incomplete within one project or accross multiple.
Solution: when a user implements a merge (or associates an external authority, in what is also kind of a merge), a timestampted merge order is deposed in the CEDB registry, and in the PEDB registry of everything available to him on his machine, then we launch a crawl that merges those CEDB ids in all the PEDB, and merges associated PEDB ids in the PEDB and in all project XML files. If he didn't get everything on his local machine, that's fine, because periodic sweeps and filters will identify the problems and the instructions to apply. This is also the case if he, say, restores a corpus from a checkpoint, unzips an archive, or whatever. Let's say for whatever reason he has a separate CEDB on his work computer ; that's also fine, because the PEDB is now merged, and there are merge orders. In fact, we could prompt him to accept the same merge orders on his work machine CEDB, translating between PEDB ids and CEDB ids, THEN, we could have his work machine issue a merge order accross all corpora at its disposal. Or, he could reject, and the change would be limited to the one PEDB to which he connected on his home machine. The same principal would work for collaborators.  

Story B — You renamed or moved a folder
The merge or purge order misses a folder, because it can't find it. However, once we relink its PEDB to the CEDB that issued the order, it will see that there was an order, and it will implement it. You cannot use LJB without a CEDB.

Story C — Git clone on a second computer
Same as B

Story D — Dropbox has not finished downloading
This is why there are timestamps, right? if it disappears, reappears, but is still older, once it's linked to a CEDB we'll see that they're not in sync and that there were merge or purge orders since last linked.

Story E — Corrupt or half-synced address book
Most recent wins. If that is occassionaly arbitrary or destructive, then one rolls back to the last save point.

Story F — A project you never opened after creating the catalogue
The CEDB should live in the cloud and never have this problem. Nevertheless, we should offer a Unison solution to merging two forked versions of a single CEDB. All entries are individually time stamped, so
- Identical entries with the same timestamp: ignore
- Identical entries with different timestamps: update older one's timestamp
- Non-identical entries : have user validate, with option to 'keep all more recent items'

## Questions

### You cannot use LJB without a CEDB”
That is how LJB is built, but, yes, they should be able to run a PEDB without linking it to their CEDB. The real question is how does a collaborator using, say, XMLMind or Oxygen meant to plug into the LJB assets. I don't have an answer to that, but maybe we can solve that much later.

### Automatic apply of CEDB merge orders into PEDB “with or without his say”
Yes, prompt on whether to accept merge orders FROM A DIFFERENT CEDB.

### “Most recent wins” on children
Safer rule for conflicts: field-level merge when possible (union authorities; keep both name variants); prompt when the same field disagrees (two different birth years). “Keep all more recent items” as a bulk option is fine after showing the diff.

### Flushing orphan PEDB ids from the corpus
Correct as a safety action, but treat it as severe: warn with counts, offer “list occurrences,” and prefer Time Machine over silent strip. Orphan keys often mean “PEDB rolled back” or “file from another project” — your file-level PEDB UUID should catch the second case before flush.

### Periodic sync vs on-event sync
“At regular intervals”:
on project open;
after Absorb / authority link / Promote;
optionally idle/background later.
Orders make delayed catch-up safe; you do not need a timer for correctness.

### Registry of merges — where it lives
Orders stored with CEDB and PEDB. If user A applies a merge or purge to a shared corpus, that will already transform it and its PEDB. Saving merge orders there is less about asking the collaborator if he accepts, but leaving a note explaining what was done.

### Both sides UUID starting with a letter
uuids must start with a letter. If we're using @key, would should indeed prefix 'person', 'title', 'place', etc., as we do now.


### CEDB alone on a single computer
CEDB is mandatory, so too is PEDB.
