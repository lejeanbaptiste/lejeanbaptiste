/** Tag a short courtesy/style name introduced by 字 after a keyed person. */

const STYLE_NAME_PATTERN = /^字([\p{L}\p{N}_]{1,2})([。，；、])/u;

/** Tag immediate `字XY` style-name forms after keyed person mentions. */
export function tagFollowingStyleNames(doc: Document): number {
  let tagged = 0;
  for (const person of Array.from(doc.getElementsByTagName('persName'))) {
    const key = person.getAttribute('key')?.trim();
    if (!key || person.nextSibling?.nodeType !== Node.TEXT_NODE) continue;

    const text = person.nextSibling as Text;
    const match = STYLE_NAME_PATTERN.exec(text.data);
    if (!match) continue;
    const [, styleName, punctuation] = match;
    const style = doc.createElementNS(person.namespaceURI, 'persName');
    style.setAttribute('type', 'courtesy');
    style.setAttribute('key', key);
    style.textContent = styleName;
    text.data = punctuation + text.data.slice(match[0].length);
    person.parentNode?.insertBefore(style, text);
    tagged += 1;
  }
  return tagged;
}
