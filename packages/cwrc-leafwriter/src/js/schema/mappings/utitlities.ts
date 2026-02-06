import $ from 'jquery';

export const handleGraphics = ($tag: JQuery<HTMLSpanElement>) => {
  const url = $tag.attr('url');
  if (!url) return;

  $tag.css('backgroundImage', `url(${url})`);
  $tag.css('display', 'inline-block');

  const $img = $('<img />');
  $img.attr('src', url);

  $img.hide();
  $img.on('load', function () {
    $tag.width($(this).height() ?? 0);
    $tag.height($(this).height() ?? 0);
    $img.remove();
  });

  $('body').append($img);
};
