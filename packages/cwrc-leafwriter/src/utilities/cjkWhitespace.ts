/**
 * Whitespace cleanup for East Asian no-space scripts (Chinese, Japanese,
 * Korean, Tibetan). Source XML is often pretty-printed with spaces and line
 * breaks between characters; in these scripts that whitespace is not part of
 * the text and shows as spurious gaps in WYSIWYG.
 *
 * The rule is character-based, not language-based: an ASCII whitespace run is
 * removed only when it sits between characters in a no-space East Asian script
 * (and never when a Latin/word character is on either side). That makes it
 * safe to run on any document regardless of its declared language — Latin text
 * is left untouched — so callers don't need reliable language metadata. The
 * ideographic ("long") space U+3000 is always preserved.
 */

// No-space East Asian scripts, plus CJK symbols/punctuation and full/half-width
// forms (so whitespace around 、。「」（）etc. is also cleaned). U+3000 is in
// this range but is not ASCII whitespace, so it is preserved by construction.
const EAST_ASIAN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tibetan}\p{Script=Bopomofo}　-〿︰-﹏＀-￯]/u;

// Any Unicode whitespace EXCEPT U+3000 (the ideographic "long" space), which is
// meaningful and preserved. Catches ASCII spaces/tabs/newlines and also the
// exotic spaces that arrive via paste (U+00A0 nbsp, U+2000–200A en/em/thin
// spaces, U+202F, U+205F, etc.) — the ones a source editor renders as □ boxes.
const isStrippableWhitespace = (ch: string): boolean => ch !== '　' && /\s/u.test(ch);

const isEastAsian = (ch: string): boolean => ch !== '' && EAST_ASIAN.test(ch);

/** A character from a script that uses inter-word spaces (keep spacing around it). */
const isSpacedWordChar = (ch: string): boolean => ch !== '' && /[0-9A-Za-zÀ-ɏ]/.test(ch);

/**
 * Remove ASCII whitespace between East Asian characters. A run is dropped when
 * at least one neighbour is East Asian and neither neighbour is a spaced-word
 * (Latin) character; a run between two Latin words collapses to one space;
 * anything else is left as-is. U+3000 is never removed.
 */
export function stripCjkWhitespace(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i]!;
    if (!isStrippableWhitespace(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && isStrippableWhitespace(text[j]!)) j += 1;
    const prev = out.length > 0 ? out[out.length - 1]! : '';
    const next = j < n ? text[j]! : '';

    if ((isEastAsian(prev) || isEastAsian(next)) && !isSpacedWordChar(prev) && !isSpacedWordChar(next)) {
      // between East Asian characters (or trimming next to one) — drop it
    } else if (isSpacedWordChar(prev) && isSpacedWordChar(next)) {
      out += ' ';
    } else {
      out += text.slice(i, j); // unknown context — don't damage
    }
    i = j;
  }
  return out;
}

/** Apply {@link stripCjkWhitespace} to every text node under `root`, in place. */
export function stripCjkWhitespaceInElement(root: Node): void {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const cleaned = stripCjkWhitespace(text.data);
    if (cleaned !== text.data) text.data = cleaned;
    node = walker.nextNode();
  }
}
