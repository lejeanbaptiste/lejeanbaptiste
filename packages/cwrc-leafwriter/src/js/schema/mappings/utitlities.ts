import $ from 'jquery';

import { resolveDocumentAssetUrl } from '../../../utilities/fetchResource';

export interface HandleGraphicsOptions {
  documentFilePath?: string | null;
}

const activeDocumentFilePath = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.__leafWriterProject?.getActiveFilePath?.() ?? null;
};

const isKanripoGaijiGraphic = ($tag: JQuery<Element>): boolean => {
  const $parent = $tag.parent();
  return $parent.attr('_tag') === 'g' && $parent.attr('type') === 'kanripo';
};

const applyEmSizedGraphic = ($tag: JQuery<Element>, url: string, heightAttr: string) => {
  $tag.addClass('lw-inline-graphic lw-kanripo-gaiji');
  $tag.attr('contenteditable', 'false');
  $tag.css({
    display: 'block',
    height: heightAttr,
    width: '1em',
    lineHeight: '0',
    backgroundImage: `url("${url}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center bottom',
    backgroundSize: 'auto 100%',
    transform: 'translateY(0.12em)',
  });

  const $wrap = $tag.parent();
  if ($wrap.attr('_tag') === 'g' && $wrap.attr('type') === 'kanripo') {
    $wrap.addClass('lw-kanripo-gaiji-wrap');
    $wrap.css({
      display: 'inline-block',
      verticalAlign: 'baseline',
      lineHeight: '0',
      padding: '0',
      margin: '0',
    });
  }

  const $img = $('<img />');
  $img.attr('src', url);
  $img.hide();
  $img.on('load', function (this: HTMLImageElement) {
    const naturalWidth = this.naturalWidth || 1;
    const naturalHeight = this.naturalHeight || 1;
    const emHeight = parseFloat(heightAttr) || 1;
    $tag.css('width', `${(naturalWidth / naturalHeight) * emHeight}em`);
    $img.remove();
  });
  $img.on('error', () => $img.remove());
  $('body').append($img);
};

export const handleGraphics = ($tag: JQuery<Element>, options: HandleGraphicsOptions = {}) => {
  const rawUrl = $tag.attr('url');
  if (!rawUrl) return;

  const documentFilePath = options.documentFilePath ?? activeDocumentFilePath();
  const url = resolveDocumentAssetUrl(rawUrl, documentFilePath);
  const heightAttr = ($tag.attr('height') || '').trim();
  const kanripoGaiji = isKanripoGaijiGraphic($tag);

  if (kanripoGaiji) {
    $tag.parent().addClass('lw-kanripo-gaiji-wrap');
  }

  if (heightAttr.endsWith('em')) {
    applyEmSizedGraphic($tag, url, heightAttr);
    return;
  }

  $tag.addClass('lw-inline-graphic');
  $tag.css('backgroundImage', `url("${url}")`);
  $tag.css('display', 'inline-block');

  const $img = $('<img />');
  $img.attr('src', url);

  $img.hide();
  $img.on('load', function () {
    $tag.width($(this).width() ?? 0);
    $tag.height($(this).height() ?? 0);
    $img.remove();
  });
  $img.on('error', () => $img.remove());

  $('body').append($img);
};

export const refreshGraphicsInBody = (
  body: HTMLElement | DocumentFragment | null | undefined,
  options: HandleGraphicsOptions = {},
) => {
  if (!body) return;
  $(body)
    .find('*[_tag="graphic"], *[_tag="GRAPHIC"]')
    .each((_index, element) => handleGraphics($(element), options));
};
