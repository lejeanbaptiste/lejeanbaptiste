/**
 * Hand-written types for `bdrcImport.mjs`.
 *
 * The desktop tsconfig has `allowJs` off, so TypeScript cannot infer this
 * module's shape from the .mjs source and `typeof import('./bdrcImport.mjs')`
 * resolved to an implicit any (TS7016).
 *
 * Returns are `unknown` on purpose. Both callers already narrow with an
 * explicit cast at the point of use — see `runBdrcImport` in
 * `bdrcProjectImport.ts` and the inline module type in `main.ts` — so
 * restating the full result shape here would only add a second copy to drift
 * out of step with the implementation.
 */

/** Cheap preview — one `Etext_base` call, no text fetch. */
export function inspectBdrcEtext(input: string): Promise<unknown>;

/** Fetch, extract and render a BDRC etext into TEI body sections. */
export function runBdrcImport(
  input: string,
  opts?: { windowSize?: number; forceRefresh?: boolean; split?: boolean },
): Promise<unknown>;
