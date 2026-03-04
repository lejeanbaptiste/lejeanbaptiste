import type { Toc } from '@stefanprobst/rehype-extract-toc';

declare module 'mdx/types' {
  interface MDXExports {
    tableOfContents?: Toc;
    frontmatter?: Record<string, any>;
  }
}
