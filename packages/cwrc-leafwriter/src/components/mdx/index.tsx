import type { MDXComponents, MDXProps } from 'mdx/types';
import type { ComponentType } from 'react';
import { MdxComponents } from './mdx-components';

interface Props {
  content: ComponentType<MDXProps>;
  mdxComponentOverride?: MDXComponents;
}

export const ContainerCompiledMdxContent = ({ content, mdxComponentOverride }: Props) => {
  const components = MdxComponents(mdxComponentOverride);
  const Content = content;
  return <Content components={components} />;
};
