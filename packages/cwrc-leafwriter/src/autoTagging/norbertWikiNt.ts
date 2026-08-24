import type { AuthorityCandidate } from './authority';

/**
 * Concatenates a noble title's components (fief, rank, posthumous name,
 * optional dynasty prefix) — and, for each given person name, the
 * person-wrapper forms — into flat matchable strings, the same way Norbert's
 * nttg3 pass does. Shared by the Norbert wiki-nt-links pack expander below
 * and by `ownDatabaseCandidates.ts`, so a project entity's own confirmed
 * `<nobleTitle>` produces the same kind of matchable strings (e.g. "魏武帝",
 * "魏武帝曹操") as the compiled authority pack does.
 */
export function buildNobleTitleSearchStrings(params: {
  fief?: string | null;
  roleName?: string | null;
  posthumousName?: string | null;
  posthumousNameAbbr?: string | null;
  dynasty?: string | null;
  personNames?: readonly string[];
}): { titleSearchStrings: string[]; wrapperSearchStrings: string[] } {
  const fief = params.fief?.trim();
  const roleName = params.roleName?.trim();
  const posthumousName = params.posthumousName?.trim();
  const posthumousNameAbbr = params.posthumousNameAbbr?.trim();
  const dynasty = params.dynasty?.trim();
  const uniqueNames = [
    ...new Set((params.personNames ?? []).map((name) => name.trim()).filter(Boolean)),
  ];
  const add = (out: string[], value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };

  const titleForms: string[] = [];
  add(titleForms, [posthumousName, roleName].filter(Boolean).join(''));
  add(titleForms, [posthumousNameAbbr, roleName].filter(Boolean).join(''));
  add(titleForms, roleName ?? '');

  // Skip the dynasty-prefixed variants when dynasty === fief (e.g. Liu Bei's
  // 漢昭烈帝, where Norbert records both as "漢") — they'd otherwise duplicate
  // into a garbled "漢漢昭烈帝".
  const dynastyDistinctFromFief = Boolean(dynasty && fief && dynasty !== fief);

  const titleSearchStrings: string[] = [];
  for (const titleForm of titleForms) {
    add(titleSearchStrings, [fief, titleForm].filter(Boolean).join(''));
    if (dynastyDistinctFromFief) add(titleSearchStrings, [dynasty, fief, titleForm].join(''));
  }

  const wrapperSearchStrings: string[] = [];
  for (const name of uniqueNames) {
    for (const titleForm of titleForms) {
      add(wrapperSearchStrings, [fief, titleForm, name].filter(Boolean).join(''));
      if (dynastyDistinctFromFief) {
        add(wrapperSearchStrings, [dynasty, fief, titleForm, name].join(''));
      }
    }
    if (fief && roleName) add(wrapperSearchStrings, [fief, roleName, name].join(''));
    if (dynastyDistinctFromFief && roleName) {
      add(wrapperSearchStrings, [dynasty, fief, roleName, name].join(''));
    }
  }

  return { titleSearchStrings, wrapperSearchStrings };
}

/**
 * Expand one compact Norbert/Wikipedia noble-title row at runtime.
 *
 * The plugin asset intentionally stores components and a small seed list;
 * this function is the runtime equivalent of Norbert's nttg3 pass. It keeps
 * wrapper strings and standalone-title strings separate so a title-only hit
 * cannot manufacture a person wrapper.
 */
export function expandNorbertWikiNtCandidate(
  candidate: AuthorityCandidate,
  personNamesByAuthorityId?: ReadonlyMap<string, readonly string[]>,
): AuthorityCandidate[] {
  const metadata = candidate.metadata;
  const title = metadata?.nobleTitle;
  if (!metadata?.isNobleTitle || !title) return [candidate];

  const person = metadata.wrapper?.components.persName?.trim() || candidate.primaryName;
  const linkedPersonId = metadata.wrapper?.personId;
  const personNames = [
    ...(linkedPersonId ? (personNamesByAuthorityId?.get(linkedPersonId) ?? []) : []),
    ...(candidate.names ?? []).map((name) => name.text.trim()),
    person?.trim() ?? '',
  ].filter(Boolean);

  const { titleSearchStrings, wrapperSearchStrings } = buildNobleTitleSearchStrings({
    fief: title.fief,
    roleName: title.roleName,
    posthumousName: title.posthumousName,
    posthumousNameAbbr: title.posthumousNameAbbr,
    dynasty: metadata.dynasty,
    personNames,
  });

  const expanded: AuthorityCandidate[] = [];
  if (metadata.wrapper && wrapperSearchStrings.length > 0) {
    expanded.push({
      ...candidate,
      searchStrings: wrapperSearchStrings,
      metadata: {
        ...metadata,
        teiTag: undefined,
        wrapperSearchStrings,
        titleSearchStrings,
      },
    });
  }
  if (titleSearchStrings.length > 0) {
    expanded.push({
      ...candidate,
      authorityId: `${candidate.authorityId}:title`,
      primaryName: titleSearchStrings[0]!,
      searchStrings: titleSearchStrings,
      metadata: {
        ...metadata,
        wrapper: undefined,
        teiTag: 'nobleTitle',
        wrapperSearchStrings,
        titleSearchStrings,
      },
    });
  }

  return expanded.length > 0 ? expanded : [candidate];
}

/** Expand all rows from the wiki noble-title pack for a tag-bomb run. */
export function expandNorbertWikiNtCandidates(
  candidates: Iterable<AuthorityCandidate>,
  personNamesByAuthorityId?: ReadonlyMap<string, readonly string[]>,
): AuthorityCandidate[] {
  return [...candidates].flatMap((candidate) =>
    expandNorbertWikiNtCandidate(candidate, personNamesByAuthorityId),
  );
}
