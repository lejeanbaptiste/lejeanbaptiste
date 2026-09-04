# Kaeriten encoding — planning standards for LJB

**Status:** Proposed — discovery and design guide. This document sets the
standards LJB should use while deciding how to support Japanese _kundoku_
(訓読) annotations, especially _kaeriten_ (返り点). It does not yet add a
schema extension, editor control, or import behaviour.

## Purpose

LJB needs to preserve what an edition displays, without confusing that
diplomatic evidence with an interpretation of the Japanese reading order.
Kaeriten are marks placed with a Chinese text to direct a Japanese reading;
they are not normally words in the base Chinese string. A useful LJB model
therefore has two separable products:

1. a transcription of the source order and its visible marks; and
2. optionally, an explicit, inspectable kundoku reading order.

The first is the minimum viable standard. The second is research data and
must be opt-in. LJB must never silently derive or rewrite a reading order
merely because it sees a return mark.

This policy is particularly important for historical editions, where the
mark's form, placement, absence, or apparent inconsistency can itself be
evidence.

## Evidence and interoperability baseline

The NIJL–NW / TEI-C SIG EA/JP Japanese classical-text guide recommends using
dedicated Unicode characters for kaeriten where possible. Its illustrative
model also uses linked `<w>` elements (`@prev` / `@next`) when a kundoku text
is retained, and notes that `anchor` plus `metamark` can be a simpler option.
That is a valuable project precedent, not a universal TEI profile or an LJB
schema requirement.

LJB should use standard TEI semantics first. `<metamark>` is appropriate for
a graphic/written signal that affects how a document is read rather than the
base content; it is an optional representation, not a replacement for the
actual character when a Unicode form exists.

Sources:

- [Japanese classical-text TEI guide (TEI-EAJ GitHub)](https://github.com/TEI-EAJ/jpn_classical/blob/master/jpn_classical_guideline.md)
- [Unicode Kanbun chart, U+3190–U+319F](https://www.unicode.org/charts/PDF/U3190.pdf)
- [TEI P5: `<metamark>`](https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-metamark.html)

## Character standard

For a mark that has a dedicated character, the canonical transcription is
the relevant Unicode Kanbun code point, encoded directly as UTF-8 XML text.
Do not substitute ordinary CJK characters, superscript styling, images, or
private-use characters just to imitate the appearance.

| Mark family | Dedicated character(s)                          |
| ----------- | ----------------------------------------------- |
| レ          | `㆑` U+3191 IDEOGRAPHIC ANNOTATION REVERSE MARK |
| 一–四       | `㆒`–`㆕` U+3192–U+3195                         |
| 上・中・下  | `㆖`–`㆘` U+3196–U+3198                         |
| 甲–丁       | `㆙`–`㆜` U+3199–U+319C                         |
| 天・地・人  | `㆝`–`㆟` U+319D–U+319F                         |

`㆐` (U+3190) is an ideographic annotation linking mark (_tateten_). It is
in the same Unicode block but is not itself a return mark. Conversely, plain
`一`, `レ`, and `上` are **not** the dedicated Kanbun characters.

Multiple visible marks are represented as the corresponding sequence, e.g.
`㆒㆑`, provided that this is what the source displays. The XML declaration
must specify UTF-8. Entity references may be accepted on import but should be
normalised to the Unicode characters on save, except where a project needs to
preserve a literal source transcription convention.

## Proposed LJB encoding policy

### Level K1 — diplomatic marks (initial support)

K1 preserves base text in source order and represents a kaeriten character
at its observed textual position. The mark is plain text, adjacent to the
character it annotates, unless an existing source-transcription structure is
needed to express its placement.

```xml
<p>楚人有㆘鬻㆓盾與㆒㆑矛者㆖</p>
```

This is searchable, copyable, Unicode-valid, and compatible with the cited
Japanese guideline. It records no claim about token boundaries or the exact
resolved kundoku sequence.

K1 is LJB's recommended default for import, transcription, and editing.
It should be possible to enter the dedicated marks from an editor palette or
keyboard shortcut, but the editor must not replace a user's literal text
without an explicit command.

### Level K2 — source-position and graphic annotation (when needed)

Use standard TEI source-transcription facilities when K1 cannot say enough:
for example, an unusually placed, marginal, corrected, uncertain, or
non-Unicode mark. `anchor` may identify a position in the base sequence;
`metamark` can carry the signal and, where applicable, identify its function
and target. Link to a facsimile zone with `@facs` when exact position matters.

The exact K2 pattern should be adopted only after testing it against LJB's
current schema and editor serializer. An illustrative pattern is:

```xml
<w xml:id="w-you">有<anchor xml:id="a-you"/></w>
<metamark function="transposition" target="#a-you">㆘</metamark>
```

This is not a prescription that every ordinary `㆘` be expanded into two
elements. It is warranted only where markup adds information K1 cannot carry.
The project must record any local value such as `function="transposition"`
in its ODD/schema documentation and validate it consistently.

### Level K3 — explicit reading order (research annotation)

When a project has verified a kundoku interpretation, wrap stable units in
`<w xml:id="…">` and link the reading sequence with TEI global linking
attributes such as `@prev` and `@next`. XML document order remains the source
order; linked order represents the interpretation. A kundoku rendering may
then be generated without changing the diplomatic transcription.

```xml
<p>
  <w xml:id="w1" next="#w2">楚人</w>
  <w xml:id="w2" prev="#w1" next="#w3">有㆘</w>
  <w xml:id="w3" prev="#w2">鬻㆓</w>
</p>
```

The example only demonstrates linking mechanics; it is deliberately not a
complete syntactic analysis of the sentence. Production K3 data needs clear
rules for tokenisation, the first/last node, punctuation, inserted Japanese
okurigana, readings, and whether links include annotations or only base-text
tokens. A `@next` chain must be acyclic and must not cross a declared scope
without an explicit project rule.

K3 must be created through a reviewed editorial workflow or clearly marked
as an automated proposal (`@resp`, `@cert`, and revision history as
appropriate). It is not a safe automatic consequence of K1.

## Required decisions before implementation

1. **Scope:** Is the first release limited to kaeriten, or does it include
   okurigana, kana glosses, punctuation, and reading aids collectively known
   as _kunten_ (訓点)?
2. **Editorial target:** Does LJB preserve a particular printed edition,
   represent a normalised scholarly text, or support both in parallel?
3. **Association rule:** For K1, specify precisely whether the mark follows
   the governed graph in logical XML order (the default proposed above), and
   how a mark spanning/visually offset from a graph is recorded.
4. **K2 threshold:** Define the cases that need an `anchor`/`metamark` and
   facsimile linkage; do not introduce them for ordinary marks by default.
5. **K3 model:** Decide whether the reading order is links among source-order
   `<w>` tokens, a separate derived reading text, or both. The recommended
   initial choice is source-order tokens plus links, because it avoids
   duplication.
6. **Authority and certainty:** Decide which roles may assert or amend K3
   links, and how unverified readings are labeled.
7. **Rendering:** Test target fonts and vertical layout. Code-point fidelity
   is separate from a font's ability to place the glyph correctly.

## Schema, UI, import, and export requirements

- Confirm that the project TEI schema accepts the dedicated characters in
  normal text and, before K2, that `metamark` and `anchor` are available in
  the intended inline contexts. Add no new LJB element merely for kaeriten.
- Provide a discoverable input palette with labels, glyph, and code point;
  include compound common entries such as `㆒㆑` only as convenient insertion
  macros, not separate invented characters.
- Preserve code points verbatim through XML parser, editor model, clipboard,
  find/replace, export, and re-import. Searching for a plain `レ` must not be
  treated as matching `㆑` unless the user deliberately chooses a
  normalised search mode.
- Imports should recognise both dedicated marks and documented legacy/plain
  substitutions, warn about ambiguous substitutions, and retain original
  input/provenance where conversion is made.
- Rendering must degrade honestly: if the chosen font lacks a glyph, show a
  visible missing-glyph warning or fallback—not a silently substituted base
  character. PDF/EPUB export tests must embed or select a capable font.

## Validation and test corpus

Add fixtures before UI work. At minimum they should cover:

- every U+3191–U+319F mark, `㆐` separately, and compound `㆒㆑`;
- source-order round trips in UTF-8 XML;
- vertical and horizontal editor rendering with a supported and an
  unsupported font;
- a mark at a line/page boundary and one tied to a facsimile position;
- K2 validation for `target`/`facs` references;
- K3 valid chain, broken target, duplicate predecessor, cycle, and
  cross-scope rejection;
- import of plain `レ`/`一`-style legacy text, with no silent conversion;
- copy/paste, find/replace, and export/re-import preservation.

Acceptance for K1 is simple: a document containing the marks opens, edits,
saves, validates, renders, and round-trips without any code-point change.
K2/K3 must additionally preserve all links and expose invalid references to
the user.

## Phased plan

| Phase               | Deliverable                                                                         | Exit criterion                                                               |
| ------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0. Corpus discovery | Collect 10–20 representative witnesses and record each notation and layout problem. | Decisions above are answered from real material.                             |
| 1. K1               | UTF-8 preservation, palette/input, tests, font/export checks.                       | Dedicated characters round-trip losslessly.                                  |
| 2. K2               | Schema-confirmed source-position pattern, facsimile linkage, inspector support.     | Complex placements can be encoded without a local ad-hoc element.            |
| 3. K3               | Reviewed tokenisation/linking workflow and validation.                              | A verified kundoku sequence is navigable and exportable without altering K1. |
| 4. Interchange      | Import/export mapping and public profile documentation.                             | A partner can create valid LJB kaeriten data without relying on the UI.      |

## Initial recommendation

Adopt **K1 as the LJB baseline now**: dedicated Unicode Kanbun characters in
source order, faithfully preserved and documented in `encodingDesc`.
Defer `<metamark>`/`anchor` and reading-order links until the project has a
representative corpus and a stated research use for them. This keeps the
first implementation interoperable and reversible while leaving a clean path
to richer scholarly annotation.
