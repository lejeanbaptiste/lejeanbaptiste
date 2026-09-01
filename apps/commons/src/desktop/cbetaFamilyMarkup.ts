/**
 * Markup fix-ups shared by every corpus importer when the target project uses
 * the CBETA P5 catalog (`catalogId: 'cbeta'`).
 *
 * The CBETA-flavoured schema (`ljb-cbeta-loosen`) differs from plain TEI in ways
 * that matter for a spliced-in body:
 *
 *   - a body division must be `<cb:div>` (the CBETA namespace element); a plain
 *     TEI `<div>` is not accepted in `<body>` ("Tag div not allowed in body");
 *   - `<cb:div>` has no `<ab>` in its content model — a folio block is a `<p>`;
 *   - `att.global` `@n` rejects a CJK value on a division and the failure
 *     cascades to the whole `<body>` model;
 *   - `<author>` takes only `att.global` + `att.canonical` — no `@role`;
 *   - `<title>` takes `@level`, not `@type`.
 */

/** Rewrite a `<body>` fragment for a CBETA P5 target. */
export const cbetaFamilyBodyFragment = (fragment: string): string =>
  fragment
    .replace(/<(\/?)ab(\s[^>]*)?>/g, '<$1p$2>')
    .replace(/<(\/?)div(\s[^>]*)?>/g, '<$1cb:div$2>')
    .replace(/(<cb:div\b[^>]*?)\s+n="[^"]*"/g, '$1');

/** Strip attributes the CBETA schema rejects from a `<titleStmt>` author list. */
export const cbetaFamilyTitleStmt = (fragment: string): string =>
  fragment
    .replace(/(<author\b[^>]*?)\s+role="[^"]*"/g, '$1')
    .replace(/(<title\b[^>]*?)\s+type="[^"]*"/g, '$1');
