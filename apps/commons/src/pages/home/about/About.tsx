import { ContainerCompiledMdxContent } from '@src/components/mdx';
import { useAppState } from '@src/overmind';

import * as en from '@src/content/about/en.mdx';
import * as es from '@src/content/about/es.mdx';
import * as fr from '@src/content/about/fr.mdx';
import * as pt from '@src/content/about/pt.mdx';
import * as ro from '@src/content/about/ro.mdx';

// Static mapping of content by locale
const aboutContentMap = {
  //@ts-ignore
  en: { content: en.default, tableOfContents: en.tableOfContents },
  //@ts-ignore
  es: { content: es.default, tableOfContents: es.tableOfContents },
  //@ts-ignore
  fr: { content: fr.default, tableOfContents: fr.tableOfContents },
  //@ts-ignore
  pt: { content: pt.default, tableOfContents: pt.tableOfContents },
  //@ts-ignore
  ro: { content: ro.default, tableOfContents: ro.tableOfContents },
};

export const About = () => {
  const { currentLocale } = useAppState().ui;
  const aboutContent = aboutContentMap[currentLocale as keyof typeof aboutContentMap];

  return <ContainerCompiledMdxContent content={aboutContent.content} />;
};
