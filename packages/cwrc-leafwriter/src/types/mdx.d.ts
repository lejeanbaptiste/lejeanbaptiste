import type { Toc } from '@stefanprobst/rehype-extract-toc';

declare module 'mdx/types' {
  interface MDXExports {
    frontmatter?: Record<string, any>;
    tableOfContents?: Toc;
  }
}
