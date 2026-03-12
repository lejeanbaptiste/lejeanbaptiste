import * as de from '@src/content/about/de.mdx';
import * as en from '@src/content/about/en.mdx';
import * as es from '@src/content/about/es.mdx';
import * as fr from '@src/content/about/fr.mdx';
import * as pt from '@src/content/about/pt.mdx';
import * as ro from '@src/content/about/ro.mdx';
import { Locales } from '@src/i18n';
import type { MDXProps } from 'mdx/types';
import type { ComponentType } from 'react';
import { ProfileProps } from './team-profile';

interface AboutFrontmatter {
  team?: ProfileProps[];
  [key: string]: any;
}

// Static mapping of content by locale
const aboutContentMap: Record<
  Locales,
  { content: ComponentType<MDXProps>; frontmatter: AboutFrontmatter }
> = {
  //@ts-ignore
  de: { content: de.default, frontmatter: de.frontmatter },
  //@ts-ignore
  en: { content: en.default, frontmatter: en.frontmatter },
  //@ts-ignore
  es: { content: es.default, frontmatter: es.frontmatter },
  //@ts-ignore
  fr: { content: fr.default, frontmatter: fr.frontmatter },
  //@ts-ignore
  pt: { content: pt.default, frontmatter: pt.frontmatter },
  //@ts-ignore
  ro: { content: ro.default, frontmatter: ro.frontmatter },
};

export const getAboutContent = (locale: Locales) => {
  return aboutContentMap[locale];
};
