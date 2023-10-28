export const handleGraphics = ($tag: JQuery<any>) => {
  const url = $tag.attr('url');
  if (!url) return;

  $tag.css('backgroundImage', `url(${url})`);
  $tag.css('display', 'inline-block');

  const $img = $('<img />');
  $img.hide();
  $img.on('load', (element) => {
    const height = $(element).height() ?? 0;
    const width = $(element).width() ?? 0;
    $tag.width(width);
    $tag.height(height);
    $img.remove();
  });

  $('body').append($img);
  $img.attr('src', url);
};
