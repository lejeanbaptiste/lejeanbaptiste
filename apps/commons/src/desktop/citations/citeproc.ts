import CSL from 'citeproc';
import type { CslJsonItem } from './types';

/**
 * Thin wrapper around citeproc-js for rendering footnote citations. Pure with respect to
 * assets: style and locale XML are passed in (see styleAssets.ts), so this module is
 * jest-testable without webpack loaders.
 */

export interface CitationRenderer {
  render: (options: {
    item: CslJsonItem;
    locator?: string;
    locatorType?: string;
    prefix?: string;
    suffix?: string;
  }) => string;
}

export const createCitationRenderer = (styleXml: string, localeXml: string): CitationRenderer => {
  const items = new Map<string, CslJsonItem>();
  const engine = new CSL.Engine(
    {
      retrieveLocale: () => localeXml,
      retrieveItem: (id: string) => {
        const item = items.get(id);
        if (!item) throw new Error(`Unknown citation item: ${id}`);
        return item as Record<string, unknown>;
      },
    },
    styleXml,
  );

  return {
    render: ({ item, locator, locatorType, prefix, suffix }) => {
      const id = String(item.id);
      items.set(id, item);
      engine.updateItems([id]);
      const html = engine.previewCitationCluster(
        {
          citationItems: [
            {
              id,
              locator: locator || undefined,
              label: locator ? locatorType || 'page' : undefined,
              prefix: prefix || undefined,
              suffix: suffix || undefined,
            },
          ],
          properties: { noteIndex: 1 },
        },
        [],
        [],
        'html',
      );
      return citeprocHtmlToTei(html);
    },
  };
};

const REND_BY_TAG: Record<string, string> = {
  b: 'bold',
  em: 'italic',
  i: 'italic',
};

/**
 * Converts citeproc's HTML output to the inline vocabulary used by the translation pane
 * (<hi rend="italic|bold|small-caps">, <sup>, <sub>, plain text elsewhere).
 */
export const citeprocHtmlToTei = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return html;

  const convert = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeXmlText(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as Element;
    const children = Array.from(element.childNodes).map(convert).join('');
    const tag = element.tagName.toLowerCase();

    if (tag === 'sup' || tag === 'sub') return `<${tag}>${children}</${tag}>`;

    const rend =
      REND_BY_TAG[tag] ??
      (/small-caps/.test(element.getAttribute('style') ?? '') ? 'small-caps' : undefined);
    if (rend) return `<hi rend="${rend}">${children}</hi>`;

    // Unknown wrappers (spans, divs citeproc sometimes emits) contribute only their text.
    return children;
  };

  return Array.from(container.childNodes).map(convert).join('');
};

const escapeXmlText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Compact label for citation chips in the footnote list, e.g. "Morgan 2020". */
export const citationChipLabel = (item: CslJsonItem): string => {
  const author =
    item.author?.[0]?.family ?? item.author?.[0]?.literal ?? item.title ?? 'Untitled';
  const year = item.issued?.['date-parts']?.[0]?.[0];
  return year ? `${author} ${year}` : String(author);
};
