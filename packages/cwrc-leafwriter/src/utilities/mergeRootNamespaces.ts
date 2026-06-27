const ROOT_OPEN_TAG_PATTERN = /^(\s*<[^\/?!][^>]*>)/;

const getRootOpenTag = (xml: string): string | null => {
  const withoutPis = xml.replace(/<\?[^?]+\?>\s*/g, '');
  return withoutPis.match(ROOT_OPEN_TAG_PATTERN)?.[1] ?? null;
};

const getPrefixedNamespaceAttributes = (openTag: string): string[] => {
  return [...openTag.matchAll(/\s(xmlns:[A-Za-z_][\w.-]*="[^"]*")/g)].map((match) => match[1]);
};

/** Copy xmlns:prefix declarations from a reference document onto exported XML when missing. */
export const mergeRootNamespaceDeclarations = (exported: string, reference: string): string => {
  const referenceTag = getRootOpenTag(reference);
  const exportedTag = getRootOpenTag(exported);
  if (!referenceTag || !exportedTag) return exported;

  const missingNamespaces = getPrefixedNamespaceAttributes(referenceTag).filter(
    (attr) => !exportedTag.includes(attr),
  );

  if (missingNamespaces.length === 0) return exported;

  const mergedTag = `${exportedTag.slice(0, -1)}${missingNamespaces.join('')}>`;
  const rootTagIndex = exported.indexOf(exportedTag);
  if (rootTagIndex === -1) return exported;

  return `${exported.slice(0, rootTagIndex)}${mergedTag}${exported.slice(rootTagIndex + exportedTag.length)}`;
};
