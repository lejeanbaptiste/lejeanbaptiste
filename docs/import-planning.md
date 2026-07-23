# Document Import — Planning

*2026-07-03. Follows from notes in [document IO.md](document%20IO.md). Phase 1 is underway in `apps/commons/src/desktop/documentImport.ts`.*

## Goal

Import one file, a selection of files, or a whole folder tree (docx, odt, md, txt, rtf, …) into the current project, converting each file into a schema-valid document. Two tracks:

1. **Blind import** — strip everything but text, make paragraph breaks where appropriate, wrap in the project's document skeleton. (This is what `documentImport.ts` does today.)
2. **Profiled import** — send sample document(s) to the configured AI endpoint, have it infer an *import profile* (a declarative rule set: pattern → tag), let the user review/tweak it, then apply it deterministically across the batch.

The profile replaces the per-corpus scripts we currently write by hand, but the artifact is data (inspectable, editable, re-runnable, saved with the project), not generated code. No model-generated code is ever executed.

## What already exists (reuse targets)

| Piece | Where | Role in import |
|---|---|---|
| Blind import core (strip md/rtf, paragraph split, skeleton wrap, XML inspection, output-path dedup) | `apps/commons/src/desktop/documentImport.ts` | Phase 1 foundation |
| Document skeletons per catalog (TEI / jTEI / Orlando) | `apps/commons/src/desktop/schemaTemplates.ts` — `buildSkeletonForCatalog()` | Wrapper for imported body content |
| Project metadata → header merge | `metadataApplyOverrides.ts` / `newFile` action in `apps/commons/src/overmind/project/actions.ts` | Fill header from project metadata, per-file title from filename/front matter |
| Schema-aware paragraph normalization | `packages/cwrc-leafwriter/src/js/tinymce/normalizePastedParagraphs.ts` (`isTagValidChildOfParent`, `canTagContainText`, `getBlockTag`) | Validity predicates when placing imported blocks |
| Validator | `packages/cwrc-leafwriter-validator` | Post-import validation report per file |
| AI endpoint (OpenAI-compatible, user-configured) | `apps/desktop/src/projectPrefs.ts` (`AiApiSettings`); request pattern in `main.ts` (`generateAiTranslation`) | Profile inference call |
| File ops in project tree | `apps/desktop/src/explorerFileOps.ts` | Writing imported files, creating target folders |

Key architectural point: **import runs as a file-level pipeline and writes XML into the project folder directly** — it does not round-trip through TinyMCE. The editor's paste path is for fragments; a batch of 400 files needs the main-process path. The schema predicates in `normalizePastedParagraphs` are pure functions over the schema manager and can be extracted for headless use.

## Test corpora (in `docs/doc import/`)

Each sample exercises a different profile feature:

1. **`KR1a0145_002.txt`** — Kanseki Repository / mandoku format. Org-mode metadata lines (`#+TITLE:`, `#+PROPERTY: JUAN …`), `<pb:KR1a0145_WYG_002-1a>` page-break markers, `¶` end-of-line pilcrows where a *missing* pilcrow means the paragraph continues across the page break. Needs: line-pattern rules → `<pb/>`, metadata capture → header, pilcrow-based line joining.
2. **`nihonshoki.md`** — Wikisource-style markdown. `{{header}}` template block carrying title/section metadata (currently passes through the md stripper as literal text — needs a rule), blank-line paragraphs, `〈…〉` interlinear notes and `★`/`■` editorial symbols as inline-rule candidates.
3. **`MKBG OCR.docx`** — OCR'd Word document. Needs: docx extraction, heading/style mapping, OCR-noise tolerance (running headers, loose page numbers → `<pb/>` or drop).
4. **`HanShu_bio_007_j_34_HanXin_clean.xml`** — already-structured custom XML. Root is not TEI/Orlando, so v1 XML import rejects it with a clear error. Long-term: element-mapping rules (their `<note type="comm">` → TEI `<note>`).

## Architecture

```
files ──► Extraction layer ──► IR ──► Rule engine (profile) ──► body XML ──► skeleton wrap ──► inspect/validate ──► write + report
              (per format)          (blind = built-in minimal profile)
```

### 1. Extraction layer

One extractor per format, all producing a shared intermediate representation:

```ts
interface IrDocument {
  sourcePath: string;
  metadata: Record<string, string>;   // front matter, #+PROPERTY, {{header}}, docx core props
  blocks: IrBlock[];
}
interface IrBlock {
  kind: 'para' | 'heading' | 'line' | 'blank' | 'table' | 'image';
  level?: number;          // heading level
  styleName?: string;      // docx paragraph style, when present
  text: string;
  runs?: IrRun[];          // italic/bold/note spans, for later phases
}
```

- **txt** — lines in; paragraph detection is profile-controlled. Encoding detection matters for the CJK corpora.
- **md** — grow the current regex stripper into (or replace with) `markdown-it` token walking; capture front matter and `{{…}}` blocks into `metadata`.
- **rtf** — current stripper is adequate for blind import.
- **docx** — `mammoth` (pure JS) with a transform that keeps style names in the IR.
- **odt** — plain-text extraction (supported in Phase 1 path).
- **xml (v1)** — same-family TEI/Orlando only: demote `@key` to `@ana` (`ljb-former-key:`), attach project schema PIs, merge edition metadata, provenance note. Skip `entities.xml`. Element remapping still deferred.

### 2. Import profile (the rule set)

JSON stored in the project (e.g. `import/profiles/<name>.json`), applied by a fixed engine. Small v1 vocabulary:

```jsonc
{
  "version": 1,
  "name": "Kanseki mandoku",
  "source": { "paragraphMode": "pilcrow",   // or "blank-line" | "every-line" | "reflow"
              "pilcrowChar": "¶" },
  "metadata": [
    { "match": "^#\\+TITLE:\\s*(.+)$", "field": "title" },
    { "match": "^#\\+PROPERTY: JUAN (.+)$", "field": "custom:juan" }
  ],
  "lineRules": [        // whole lines/blocks, first match wins
    { "match": "^<pb:([^>]+)>$", "action": "milestone", "tag": "pb", "attrs": { "n": "$1" } },
    { "match": "^#\\+.*$", "action": "drop" },
    { "styleName": "Heading 1", "action": "heading", "level": 1 }
  ],
  "inlineRules": [      // inside paragraph text
    { "match": "〈([^〉]*)〉", "action": "wrap", "tag": "note", "attrs": { "type": "inline" } }
  ],
  "structure": { "headingTag": "head", "sectionTag": "div", "paragraphTag": "p" }
}
```

Engine properties:

- **Deterministic** — same profile + same files = same output.
- **Schema-checked** — placements verified with the `normalizePastedParagraphs` predicates; invalid placements fall back to the block tag and are flagged, never silently dropped.
- **Auditable** — per-file rule-match counts in the import report; a paginated corpus with one file matching zero `pb` rules is surfaced as an anomaly.
- **Blind import is just a built-in profile** (`paragraphMode: "blank-line"` / `"reflow"`, no rules) — one code path.

### 3. AI profile inference

- Reuse `AiApiSettings` and the `generateAiTranslation` request pattern (OpenAI-compatible `chat/completions`); works with the LM Studio default.
- Input: 1–3 sample files (head + a middle slice, capped ~8k chars each), the profile JSON Schema, a short description of the target schema (catalog id + block/heading/paragraph tags).
- Output: profile JSON, validated against the profile schema; invalid → one retry with the validation error, then fall back to blind profile with a notice.
- The model never sees the whole corpus; its output is interpreted, never executed.

### 4. Batch pipeline & output

- Selection: native dialog, multi-select files or a folder (recursive, filtered to supported extensions).
- Output mirrors the source tree under a chosen folder inside the project root (default `imported/<batch>/`), one `.xml` per source, filename slugified, existing-path auto-suffixing as already implemented.
- Each output: skeleton → merge project metadata → per-file `<title>` (profile `title` field, else filename) → body → provenance in `sourceDesc` (source path, import date, profile name).
- Validate each file; report lists blocks emitted, rule hit counts, validation status, anomalies. Large batches don't auto-open tabs; single-file import opens the result.
- Idempotent re-runs: skip-or-overwrite prompt.

### 5. UI flow

1. **File → Import…** → pick files/folder.
2. Import dialog: *Blind* (paragraph-mode dropdown) or *Analyze with AI* (sample picker, defaults to first + median-size file).
3. Profile review panel: rules rendered human-readably ("lines like `<pb:…>` → page break `<pb n='…'/>` — matched 214× in sample") with live preview of the first sample's XML; rules can be disabled/edited/added; profiles save/load.
4. Run → progress → import report → reveal in explorer.

## Phasing

- **Phase 1 — Blind import (txt/md/rtf), single + batch.** Largely done in `documentImport.ts`; remaining: `{{header}}` handling in md, folder recursion + batch UI, validator wiring, provenance in header.
- **Phase 2 — Profile engine + manual profiles.** Rule vocabulary, IR, save/load, review panel with preview. Acceptance: hand-written mandoku profile imports `KR1a0145_002.txt` with `<pb/>` elements and correctly joined lines.
- **Phase 3 — docx extraction.** mammoth with style names; style-name rules. Acceptance: `MKBG OCR.docx` imports with headings mapped and page-number noise handled.
- **Phase 4 — AI inference.** Sampling, prompt, schema validation, retry, review-panel wiring. Acceptance: analyzing `KR1a0145_002.txt` yields a profile matching (± one tweak) the Phase 2 hand-written one.
- **Deferred:** full element-mapping profiles for exotic XML (HanShu custom tags → TEI); docx footnotes/runs; tables/images; Zotero-linked citation recognition.
- **XML import (v1, 2026-07-23):** `.xml` is accepted by Import Documents. Same-family only (TEI↔TEI including jTEI; Orlando↔Orlando). Keeps body structure; attaches project schema PIs; demotes `@key` → `@ana` token `ljb-former-key:…` with a warning dialog; merges project edition metadata; adds a short `sourceDesc` provenance note. Cross-family conversion and element remapping still deferred.

## Open questions

1. **Reflow default for txt** — auto-detect hard-wrapping per file (if most lines cluster near the modal line length, join single newlines) with profile override?
2. **Schema predicates headless** — extract the three predicates from `normalizePastedParagraphs` into a shared module rather than instantiating an editor.
3. **Profile scope** — per-project files; cross-project sharing is free (plain JSON) if wanted.
4. **Large-batch validation cost** — validate lazily on open, with a "validate all" button in the report?
