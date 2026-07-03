declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { MDXProps } from 'mdx/types';
  import type { Toc } from '@stefanprobst/rehype-extract-toc';

  const tableOfContents: Toc;
  const MDXContent: ComponentType<MDXProps>;

  export const frontmatter: Record<string, any>;
  export { tableOfContents };
  export default MDXContent;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
