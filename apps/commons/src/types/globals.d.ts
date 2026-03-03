declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { MDXProps } from 'mdx/types';
  import type { Toc } from '@stefanprobst/rehype-extract-toc';

  const tableOfContents: Toc;
  const MDXContent: ComponentType<MDXProps>;

  export default MDXContent;
  export { tableOfContents };
}
