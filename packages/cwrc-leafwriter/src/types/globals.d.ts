declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { MDXProps } from 'mdx/types';
  import type { Toc } from '@stefanprobst/rehype-extract-toc';

  const tableOfContents: Toc;
  const MDXContent: ComponentType<MDXProps>;

  export default MDXContent;
  export { tableOfContents };
}

declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export = classes;
}
