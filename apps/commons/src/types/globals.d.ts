import type { ComponentType } from 'react';
import type { MDXProps } from 'mdx/types';
import type { Toc } from '@stefanprobst/rehype-extract-toc';

declare module '*.mdx' {
  const tableOfContents: Toc;
  const MDXContent: ComponentType<MDXProps>;

  export { tableOfContents };
  export const frontmatter: Record<string, any>;
  export default MDXContent;
}
