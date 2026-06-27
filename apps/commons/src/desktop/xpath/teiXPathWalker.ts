interface TeiSegment {
  index: number;
  tag: string;
}

const localTagName = (tag: string) => (tag.includes(':') ? tag.split(':').pop()! : tag);

/** Match _tag attribute against a TEI segment tag (handles cb:div vs div). */
export const matchesTeiTag = (attrTag: string | null, wanted: string): boolean => {
  if (!attrTag) return false;
  const wantedLocal = localTagName(wanted).toLowerCase();
  const attrLocal = localTagName(attrTag).toLowerCase();
  return attrLocal === wantedLocal || attrTag.toLowerCase() === wanted.toLowerCase();
};

/** Parse TEI-style xpath segments (1-based indices in xpath become 0-based here). */
export const parseTeiXPathSegments = (xpath: string): TeiSegment[] => {
  return xpath
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(?:[\w.-]+:)*([\w.-]+)(?:\[(\d+)\])?$/);
      if (!match) {
        const bare = segment.replace(/\[.*\]/, '');
        return { tag: localTagName(bare), index: 0 };
      }
      return {
        tag: match[1],
        index: match[2] ? parseInt(match[2], 10) - 1 : 0,
      };
    });
};

const tagChildren = (parent: Element, tag: string): Element[] => {
  return Array.from(parent.children).filter(
    (el): el is Element =>
      el.nodeType === Node.ELEMENT_NODE && matchesTeiTag(el.getAttribute('_tag'), tag),
  );
};

const findRootCandidate = (body: HTMLElement, tag: string, index: number): Element | null => {
  let candidates = tagChildren(body, tag);
  if (candidates.length > 0) {
    return candidates[index] ?? candidates[0] ?? null;
  }

  const all = Array.from(body.querySelectorAll('*')).filter((el) =>
    matchesTeiTag(el.getAttribute('_tag'), tag),
  );
  if (all.length === 0) return null;

  const depthOf = (el: Element) => {
    let d = 0;
    let node: Element | null = el;
    while (node && node !== body) {
      d += 1;
      node = node['parentElement'];
    }
    return d;
  };

  const minDepth = Math.min(...all.map(depthOf));
  candidates = all.filter((el) => depthOf(el) === minDepth);
  return candidates[index] ?? candidates[0] ?? null;
};

/** Walk the CWRC editor DOM using TEI-style xpath segments (_tag names). */
export const findEditorNodeByTeiXPath = (
  body: HTMLElement,
  teiXpath: string,
): Element | null => {
  const segments = parseTeiXPathSegments(teiXpath);
  if (segments.length === 0) return null;

  let current = findRootCandidate(body, segments[0].tag, segments[0].index);
  if (!current) return null;

  for (let i = 1; i < segments.length; i++) {
    const candidates = tagChildren(current, segments[i].tag);
    current = candidates[segments[i].index] ?? null;
    if (!current) return null;
  }

  return current;
};

export const describeTeiXPathWalkFailure = (
  body: HTMLElement,
  teiXpath: string,
): { failedAt: number; segment: string; candidateCount: number } | null => {
  const segments = parseTeiXPathSegments(teiXpath);
  if (segments.length === 0) return { failedAt: 0, segment: teiXpath, candidateCount: 0 };

  let current: Element | null = findRootCandidate(body, segments[0].tag, segments[0].index);
  if (!current) {
    return {
      failedAt: 0,
      segment: segments[0].tag,
      candidateCount: tagChildren(body, segments[0].tag).length,
    };
  }

  for (let i = 1; i < segments.length; i++) {
    const candidates = tagChildren(current, segments[i].tag);
    const next = candidates[segments[i].index] ?? null;
    if (!next) {
      return {
        failedAt: i,
        segment: segments[i].tag,
        candidateCount: candidates.length,
      };
    }
    current = next;
  }

  return null;
};
