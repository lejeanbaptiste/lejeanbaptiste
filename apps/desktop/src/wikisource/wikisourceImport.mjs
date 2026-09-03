import {
  classifyWikisourcePage,
  classifyWikisourceTitle,
  fetchPageInfo,
  fetchPageLinks,
  fetchPageWikitext,
  getFetchDelayMs,
  isWikisourceSubPageTitle,
  listEditionTrees,
  listVolumePages,
  parseWikisourceUrl,
  sleep,
  workTitleFromPageTitle,
} from './wikisource-parallel.mjs';
import { fetchWikidataWorkMetadata } from './wikidata.mjs';
import { wikitextToBodyXml, wikisourceLocaleFromHost } from './wikitextToTei.mjs';
import { expandPagesTranscription } from './proofreadPages.mjs';

const expandEditionTree = async (apiHost, tree) => {
  if (!tree.needsFetch) return tree;
  const links = await fetchPageLinks(apiHost, tree.rootTitle);
  const pages = listVolumePages(links, tree.rootTitle);
  return {
    ...tree,
    pages,
    needsFetch: false,
    label: pages.length ? `${tree.rootTitle} (${pages.length} pages)` : tree.rootTitle,
  };
};

const resolveQid = async (apiHost, pageTitle, workTitle) => {
  const pageInfo = await fetchPageInfo(apiHost, pageTitle);
  if (pageInfo.qid) return { qid: pageInfo.qid, qidTitle: pageInfo.canonicalTitle };
  if (workTitle && workTitle !== pageTitle) {
    const workInfo = await fetchPageInfo(apiHost, workTitle);
    if (workInfo.qid) return { qid: workInfo.qid, qidTitle: workInfo.canonicalTitle };
  }
  return { qid: null, qidTitle: pageInfo.canonicalTitle };
};

export async function inspectWikisourceImport(url) {
  const parsed = parseWikisourceUrl(url);
  if (!parsed) {
    throw new Error('Not a Wikisource URL (expected …wikisource.org/wiki/… or …/zh-hant/…).');
  }

  const titleGate = classifyWikisourceTitle(parsed.title);
  if (!titleGate.ok) throw new Error(titleGate.reason);

  const info = await fetchPageInfo(parsed.apiHost, parsed.title);
  const pageGate = classifyWikisourcePage(info.page);
  if (!pageGate.ok) throw new Error(pageGate.reason);

  const canonicalTitle = info.canonicalTitle;
  const workTitle = workTitleFromPageTitle(canonicalTitle);
  const scope = isWikisourceSubPageTitle(canonicalTitle) ? 'page' : 'work';
  const links = await fetchPageLinks(parsed.apiHost, workTitle);
  let trees = listEditionTrees(workTitle, links);
  const expanded = [];
  for (let index = 0; index < trees.length; index += 1) {
    if (index > 0) await sleep(getFetchDelayMs());
    expanded.push(await expandEditionTree(parsed.apiHost, trees[index]));
  }
  trees = expanded.filter((tree) => tree.pages.length > 0);
  if (!trees.length) {
    trees = [
      {
        id: `single:${canonicalTitle}`,
        label: canonicalTitle,
        rootTitle: canonicalTitle,
        kind: 'single',
        pages: [canonicalTitle],
        needsFetch: false,
      },
    ];
  }

  const { qid, qidTitle } = await resolveQid(parsed.apiHost, canonicalTitle, workTitle);
  let wikidata = {
    qid: null,
    title: workTitle,
    authors: [],
    publicationDate: null,
    ctextWorkId: null,
    language: '',
  };
  if (qid) {
    wikidata = await fetchWikidataWorkMetadata(qid);
  }

  return {
    url: url.trim(),
    wiki: parsed.origin,
    apiHost: parsed.apiHost,
    pageTitle: canonicalTitle,
    workTitle,
    scope,
    qidTitle,
    trees,
    wikidata,
  };
}

export async function fetchWikisourceImportPages(options) {
  const { apiHost, titles, signal } = options;
  const locale = wikisourceLocaleFromHost(apiHost);
  const pages = [];
  for (let index = 0; index < titles.length; index += 1) {
    if (signal?.aborted) throw new Error('cancelled');
    if (index > 0) await sleep(getFetchDelayMs());
    const title = titles[index];
    const fetched = await fetchPageWikitext(apiHost, title);
    // Some Wikisources (confirmed on bo.wikisource content, hosted at
    // wikisource.org) hold no prose on the work page at all — just a
    // `<pages index=… from=… to=…/>` ProofreadPage transclusion tag pointing
    // at the real text on `Page:` subpages. Expand that before conversion, or
    // the import yields nothing but the surrounding {{header}} scaffolding.
    const expandedWikitext = await expandPagesTranscription(fetched.wikitext, apiHost);
    const converted = wikitextToBodyXml(expandedWikitext, { locale });
    pages.push({
      title: fetched.pageTitle || title,
      stem: (fetched.pageTitle || title).split('/').pop() || title,
      ...converted,
    });
  }
  return pages;
}
