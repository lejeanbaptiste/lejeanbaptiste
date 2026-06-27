export const offsetToLineColumn = (
  content: string,
  offset: number,
): { line: number; col: number } => {
  const before = content.slice(0, offset);
  const lines = before.split('\n');
  return {
    line: lines.length,
    col: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
};

/**
 * Finds the character offset of an element's opening tag from a simplified XPath.
 * Supports paths like /TEI/text/body/p[2] and /TEI/text/body/p/@n
 */
export const findOpenTagOffset = (xml: string, xpath: string): number | null => {
  if (!xpath) return null;

  const segments = xpath.replace(/^\//, '').split('/').filter(Boolean);
  let searchFrom = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;

    const attributeMatch = segment.match(/^@(.+)$/);
    if (attributeMatch) {
      const attrRegex = new RegExp(`\\b${attributeMatch[1]}\\s*=`, 'g');
      attrRegex.lastIndex = searchFrom;
      const match = attrRegex.exec(xml);
      return match?.index ?? null;
    }

    const tagMatch = segment.match(/^([^[]+)(?:\[(\d+)\])?$/);
    if (!tagMatch) return null;

    const tagName = tagMatch[1].split(':').pop() ?? tagMatch[1];
    const occurrence = tagMatch[2] ? parseInt(tagMatch[2], 10) : 1;
    const tagRegex = new RegExp(`<${tagName}(?=\\s|>|/)`, 'g');

    tagRegex.lastIndex = searchFrom;
    let count = 0;
    let foundIndex: number | null = null;

    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(xml)) !== null) {
      count++;
      if (count === occurrence) {
        foundIndex = match.index;
        searchFrom = match.index + 1;
        break;
      }
    }

    if (foundIndex === null) return null;
    if (isLast) return foundIndex;
  }

  return null;
};
