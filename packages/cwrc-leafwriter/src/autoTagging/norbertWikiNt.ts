import type { AuthorityCandidate } from './authority';

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

  const fief = title.fief?.trim();
  const roleName = title.roleName?.trim();
  const posthumousName = title.posthumousName?.trim();
  const dynasty = metadata.dynasty?.trim();
  const person = metadata.wrapper?.components.persName?.trim() || candidate.primaryName;
  const linkedPersonId = metadata.wrapper?.personId;
  const names = [
    ...(linkedPersonId ? personNamesByAuthorityId?.get(linkedPersonId) ?? [] : []),
    ...(candidate.names ?? []).map((name) => name.text.trim()),
    person?.trim() ?? '',
  ].filter(Boolean);
  const uniqueNames = [...new Set(names)];
  const add = (out: string[], value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };

  const titleForms: string[] = [];
  add(titleForms, [posthumousName, roleName].filter(Boolean).join(''));
  add(titleForms, roleName ?? '');

  const titleSearchStrings: string[] = [];
  for (const titleForm of titleForms) {
    add(titleSearchStrings, [fief, titleForm].filter(Boolean).join(''));
    if (dynasty && fief) add(titleSearchStrings, [dynasty, fief, titleForm].join(''));
  }

  const wrapperSearchStrings: string[] = [];
  for (const name of uniqueNames) {
    for (const titleForm of titleForms) {
      add(wrapperSearchStrings, [fief, titleForm, name].filter(Boolean).join(''));
      if (dynasty && fief) {
        add(wrapperSearchStrings, [dynasty, fief, titleForm, name].join(''));
      }
    }
    if (fief && roleName) add(wrapperSearchStrings, [fief, roleName, name].join(''));
    if (dynasty && fief && roleName) {
      add(wrapperSearchStrings, [dynasty, fief, roleName, name].join(''));
    }
  }

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
