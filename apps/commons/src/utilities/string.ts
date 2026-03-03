export const getFileExtension = (filename: string) => {
  return filename.split('.').pop() ?? '';
};

export const getFileNameWithoutExtension = (filename: string) => {
  const extension = getFileExtension(filename);
  return filename.slice(0, -(extension.length + 1));
};

export const renameFileAsCopy = (filename: string) => {
  const extension = getFileExtension(filename);
  const name = getFileNameWithoutExtension(filename);
  return `${name}_(copy).${extension}`;
};

export const changeFileExtension = (filename: string, newExternsion: string) => {
  const name = getFileNameWithoutExtension(filename);
  return `${name}.${newExternsion}`;
};

export const slugify = (content: string) => {
  return content
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
};

export interface MarkdownHeading {
  id: number;
  slug: string;
  title: string;
  level: number;
}

/**
 * Extracts headings from a markdown string.
 * @param content The markdown string to extract headings from.
 * @returns An array of headings.
 */
export const extractMarkdownHeadings = (content: string) => {
  const headings: MarkdownHeading[] = [];

  // match the `#` syntax for headings
  const headingMatcher = /^(#+)\s(.+)$/gm;

  let match = headingMatcher.exec(content);
  while (match !== null) {
    const id = Math.floor(Math.random() * 900000) + 100000;
    const level = match[1].length;
    const title = match[2].trim();
    const slug = slugify(title);

    headings.push({ id, slug, title, level });
    match = headingMatcher.exec(content);
  }

  return headings;
};
