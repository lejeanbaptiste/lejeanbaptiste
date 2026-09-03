const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const decodeEntities = (value) =>
  String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

const findBalanced = (text, open, close, start) => {
  if (!text.startsWith(open, start)) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text.startsWith(open, index)) {
      depth += 1;
      index += open.length - 1;
      continue;
    }
    if (text.startsWith(close, index)) {
      depth -= 1;
      if (depth === 0) {
        return { inner: text.slice(start + open.length, index), end: index + close.length };
      }
      index += close.length - 1;
    }
  }
  return null;
};

const parseTemplateArgs = (inner) => {
  const parts = [];
  let current = '';
  let depthBrace = 0;
  let depthLink = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const slice = inner.slice(index);
    if (slice.startsWith('{{')) {
      depthBrace += 1;
      current += '{{';
      index += 1;
      continue;
    }
    if (slice.startsWith('}}') && depthBrace > 0) {
      depthBrace -= 1;
      current += '}}';
      index += 1;
      continue;
    }
    if (slice.startsWith('[[')) {
      depthLink += 1;
      current += '[[';
      index += 1;
      continue;
    }
    if (slice.startsWith(']]') && depthLink > 0) {
      depthLink -= 1;
      current += ']]';
      index += 1;
      continue;
    }
    if (inner[index] === '|' && depthBrace === 0 && depthLink === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += inner[index];
  }
  parts.push(current);
  const name = (parts.shift() || '').trim().toLowerCase();
  const named = {};
  const positional = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      named[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    } else if (part.trim()) {
      positional.push(part.trim());
    }
  }
  return { name, named, positional };
};

const stripHtmlComments = (wikitext) => String(wikitext || '').replace(/<!--[\s\S]*?-->/g, '');

// Purely presentational HTML tags Wikisource pages use for typography (`{{xx-larger}}`
// renders as `<big>`, etc.) — this importer keeps no bold/italic/size semantics, so
// these are unwrapped like div/span/br rather than left to fall through to
// convertInline's plain-text path, where they'd be XML-escaped as literal `&lt;big&gt;`.
const stripWrapperTags = (wikitext) =>
  String(wikitext || '').replace(
    /<\/?(?:onlyinclude|includeonly|poem|div|span|br|big|small|center|b|i|u|s|tt|code|sup|sub|em|strong|font|blockquote|hr)\b[^>]*>/gi,
    '',
  );

const stripNoinclude = (wikitext) =>
  stripWrapperTags(
    stripHtmlComments(
      String(wikitext || '')
        .replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, '')
        .replace(/<includeonly>|<\/includeonly>/gi, ''),
    ),
  );

/**
 * A `{{header}}` field value is raw wikitext, not plain text — e.g.
 * `title={{xx-larger|[[Some Title]]}}` (confirmed live on bo.wikisource
 * content 2026-09-03). Resolve it to plain text for callers that embed it as
 * a citation string (`headerCredit` in WikisourceImportDialog.tsx): unwrap
 * typographic templates to their one argument, take a link's display text,
 * and leave real prose alone. No XML escaping here — this feeds plain-text
 * fields, not markup, and callers already escape on their own.
 */
const wikitextInlineToPlainText = (text) => {
  const source = String(text || '');
  let output = '';
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('{{', index)) {
      const balanced = findBalanced(source, '{{', '}}', index);
      if (!balanced) {
        output += source[index];
        index += 1;
        continue;
      }
      const parsed = parseTemplateArgs(balanced.inner);
      const arg = parsed.positional[0] ?? '';
      if (arg) output += wikitextInlineToPlainText(arg);
      index = balanced.end;
      continue;
    }
    if (source.startsWith('[[', index)) {
      const balanced = findBalanced(source, '[[', ']]', index);
      if (!balanced) {
        output += source[index];
        index += 1;
        continue;
      }
      const display = balanced.inner.includes('|')
        ? balanced.inner.slice(balanced.inner.lastIndexOf('|') + 1)
        : balanced.inner;
      output += wikitextInlineToPlainText(display);
      index = balanced.end;
      continue;
    }
    output += source[index];
    index += 1;
  }
  return decodeEntities(output).trim();
};

const extractHeader = (wikitext) => {
  const match = wikitext.match(/\{\{\s*header\b/i);
  if (!match || match.index === undefined) return { rest: wikitext, header: null };
  const balanced = findBalanced(wikitext, '{{', '}}', match.index);
  if (!balanced) return { rest: wikitext, header: null };
  const parsed = parseTemplateArgs(balanced.inner);
  const rest = `${wikitext.slice(0, match.index)}${wikitext.slice(balanced.end)}`;
  return {
    rest,
    header: {
      title: wikitextInlineToPlainText(parsed.named.title || parsed.named.標題 || ''),
      author: wikitextInlineToPlainText(parsed.named.author || parsed.named.作者 || ''),
      section: wikitextInlineToPlainText(parsed.named.section || parsed.named.章節 || ''),
      notes: wikitextInlineToPlainText(parsed.named.notes || parsed.named.說明 || ''),
    },
  };
};

const pageBreakFromTemplate = (parsed) => {
  if (
    parsed.name === 'pb' ||
    parsed.name === 'pagenum' ||
    parsed.name === '頁' ||
    parsed.name === 'page'
  ) {
    const n = parsed.named.n || parsed.named.page || parsed.positional[0] || '';
    return n ? `<pb n="${escapeXml(n)}"/>` : '<pb/>';
  }
  return '';
};

const noteFromTemplate = (parsed) => {
  if (parsed.name === 'sk notes' || parsed.name === 'notes' || parsed.name === 'note') {
    const text = parsed.positional[0] || parsed.named.text || parsed.named.案 || '';
    return text ? `<note type="comm">${escapeXml(decodeEntities(text))}</note>` : '';
  }
  return '';
};

const appendPlainText = (output, text) => (text ? output + escapeXml(text) : output);

const pageBreakFromLink = (inner) => {
  const target = inner.split('|')[0].trim();
  if (!/^Page:/i.test(target) && !/^頁面:/.test(target)) return null;
  const n = target.split('/').pop() || '';
  return n ? `<pb n="${escapeXml(n)}"/>` : '<pb/>';
};

// `[[Category:…]]` is page classification, not body text — Wikisource pages
// end with several of these, and rendering their display text (as any other
// link falls through to) produces a stray "Category:Foo" paragraph.
const isCategoryLink = (inner) => /^(?:Category|分類):/i.test(inner.split('|')[0].trim());

const convertInline = (text, locale) => {
  let output = '';
  let index = 0;
  const source = text;
  while (index < source.length) {
    if (source.startsWith('{{', index)) {
      const balanced = findBalanced(source, '{{', '}}', index);
      if (!balanced) {
        output = appendPlainText(output, source[index]);
        index += 1;
        continue;
      }
      const parsed = parseTemplateArgs(balanced.inner);
      output += noteFromTemplate(parsed) || pageBreakFromTemplate(parsed);
      index = balanced.end;
      continue;
    }
    if (source.startsWith('[[', index)) {
      const balanced = findBalanced(source, '[[', ']]', index);
      if (!balanced) {
        output = appendPlainText(output, source[index]);
        index += 1;
        continue;
      }
      if (isCategoryLink(balanced.inner)) {
        index = balanced.end;
        continue;
      }
      const pb = pageBreakFromLink(balanced.inner);
      if (pb) output += pb;
      else {
        const display = balanced.inner.includes('|')
          ? balanced.inner.slice(balanced.inner.lastIndexOf('|') + 1)
          : balanced.inner;
        output = appendPlainText(output, display);
      }
      index = balanced.end;
      continue;
    }
    if ((locale === 'zh' || locale === 'generic') && source[index] === '〈') {
      const close = source.indexOf('〉', index + 1);
      if (close > index) {
        const note = source.slice(index + 1, close);
        output += `<note type="comm">${escapeXml(decodeEntities(note))}</note>`;
        index = close + 1;
        continue;
      }
    }
    let next = index + 1;
    while (
      next < source.length &&
      !source.startsWith('{{', next) &&
      !source.startsWith('[[', next) &&
      !((locale === 'zh' || locale === 'generic') && source[next] === '〈')
    ) {
      next += 1;
    }
    output = appendPlainText(output, source.slice(index, next));
    index = next;
  }
  return output;
};

const paragraphXml = (block, locale) => {
  const inline = convertInline(block.replace(/\n+/g, ''), locale).trim();
  if (!inline) return '';
  const withBreaks = inline.replace(/(<pb\b[^/]*\/>)/g, '</p>$1<p>');
  const wrapped = `<p>${withBreaks}</p>`.replace(/<p>\s*<\/p>/g, '');
  return wrapped;
};

export function wikitextToBodyXml(wikitext, options = {}) {
  const locale = options.locale === 'zh' ? 'zh' : 'generic';
  const stripped = stripNoinclude(wikitext);
  // `{{header}}` is a shared Wikisource convention, not zh-specific — extract
  // it for every locale. Any other top-level templates left in `rest` are
  // dropped by convertInline's own balanced-brace handling below, which
  // (unlike a naive `{{[^}]*}}` regex) copes with nesting like
  // `{{header|title={{xx-larger|...}}|...}}` without leaking leftover args
  // into the body as text.
  const { rest, header } = extractHeader(stripped);
  const blocks = rest
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const paragraphs = blocks.map((block) => paragraphXml(block, locale)).filter(Boolean);
  const xml = paragraphs.join('\n');
  const hasPb = /<pb\b/.test(xml);
  return {
    bodyXml: xml || '<p></p>',
    header,
    hasPb,
  };
}

export function wikisourceLocaleFromHost(apiHost) {
  return /^zh(\.|$)/i.test(String(apiHost || '')) ? 'zh' : 'generic';
}
