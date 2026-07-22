/**
 * Detects page-number artifacts left over from copy-pasting or importing a paginated
 * source (e.g. an OCR'd book) and converts each into a `<pb n="#"/>` milestone marker,
 * healing the paragraph around it when the page break interrupted a sentence mid-flow.
 */

// Private-Use-Area delimiters: never collide with real text, always valid XML content,
// and untouched by whitespace-collapsing regexes further down the import/paste pipeline.
const MARK_OPEN = '';
const MARK_CLOSE = '';

const PAGE_NUMBER_MARKER_RE = new RegExp(`${MARK_OPEN}(\\d+)${MARK_CLOSE}`, 'g');
const SOLE_PAGE_NUMBER_MARKER_RE = new RegExp(`^${MARK_OPEN}(\\d+)${MARK_CLOSE}$`);

// A line is a page-number candidate if, once trimmed, it contains at least one digit,
// is short, and has nothing outside digits/Latin letters/whitespace/common annotation
// punctuation (e.g. "345", "p. 345", "- 12 -"). Any CJK, Tibetan, or other script
// character present disqualifies the line, which is exactly what should happen for
// Asian-script sources: a running line of prose never matches, but a bare or
// Latin-annotated folio number does. The length/word-count caps keep an ordinary short
// Latin sentence (which could otherwise satisfy the charset alone) from qualifying.
const PAGE_LINE_CANDIDATE_RE = /^[0-9A-Za-z\s.,;:'"()[\]#/–—-]+$/;
const PAGE_LINE_MAX_LENGTH = 20;
const PAGE_LINE_MAX_WORDS = 4;

const isPageNumberLine = (trimmed: string): boolean => {
  if (trimmed.length > PAGE_LINE_MAX_LENGTH) return false;
  if (!PAGE_LINE_CANDIDATE_RE.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= PAGE_LINE_MAX_WORDS;
};

const extractPageNumber = (candidateLine: string): string | null => {
  const digits = candidateLine.match(/\d+/);
  return digits ? digits[0] : null;
};

// Sentence-final punctuation across Latin, CJK/Japanese, and Tibetan.
const SENTENCE_END_RE = /[.!?…。！？」』）】]$|[།༎༑]$/;

/** Indices (into `values`) of the longest strictly-increasing subsequence, preserving order. */
const longestIncreasingSubsequenceIndices = (values: number[]): number[] => {
  const n = values.length;
  const dp = new Array(n).fill(1);
  const prev = new Array(n).fill(-1);
  let bestEnd = 0;

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (values[j] < values[i] && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1;
        prev[i] = j;
      }
    }
    if (dp[i] > dp[bestEnd]) bestEnd = i;
  }

  const result: number[] = [];
  for (let k = bestEnd; k !== -1; k = prev[k]) result.push(k);
  return result.reverse();
};

/**
 * Scans raw imported/pasted text for a run of sequential page numbers (gaps allowed,
 * back-and-forth jumps rejected) and replaces each confirmed one with an internal
 * marker. Downstream, `resolvePageBreakMarkers` turns each marker into `<pb n="#"/>`
 * once the paragraph splitter/escaper for that call site has run.
 *
 * When the text immediately preceding a page number does not end in sentence-final
 * punctuation, the line breaks around the page number are healed (the paragraph the
 * page break interrupted is rejoined); otherwise the surrounding spacing is left as-is,
 * since it is a genuine paragraph break that happens to fall on a page boundary.
 */
export const tagPageBreaks = (rawText: string): string => {
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');

  const candidates: { lineIndex: number; value: number; n: string }[] = [];
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed || !isPageNumberLine(trimmed)) return;
    const n = extractPageNumber(trimmed);
    if (n === null) return;
    candidates.push({ lineIndex, value: Number(n), n });
  });

  if (candidates.length === 0) return rawText;

  const keep = new Set(longestIncreasingSubsequenceIndices(candidates.map((c) => c.value)));
  if (keep.size === 0) return rawText;

  const confirmedByLine = new Map<number, string>();
  candidates.forEach((c, idx) => {
    if (keep.has(idx)) confirmedByLine.set(c.lineIndex, c.n);
  });

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const n = confirmedByLine.get(i);
    if (n === undefined) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const marker = `${MARK_OPEN}${n}${MARK_CLOSE}`;
    const precedingText = out.join('\n').replace(/\s+$/, '');
    const heal = precedingText.length > 0 && !SENTENCE_END_RE.test(precedingText);

    if (heal) {
      while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();

      let next = i + 1;
      while (next < lines.length && lines[next].trim() === '') next += 1;

      const joined = ` ${marker} `;
      if (out.length > 0) {
        out[out.length - 1] += joined;
      } else {
        out.push(joined.trim());
      }
      if (next < lines.length) {
        out[out.length - 1] += lines[next];
        next += 1;
      }
      i = next;
    } else {
      // A genuine paragraph break happens to land on this page boundary — leave the
      // surrounding spacing exactly as it was, just swap the numeral for the marker.
      out.push(marker);
      i += 1;
    }
  }

  return out.join('\n');
};

/**
 * Renders a chunk of text that may contain (or entirely be) a page-break marker left
 * by `tagPageBreaks`. `escape` is the caller's own text-escaping function; `pb` builds
 * the final markup for a single page break (e.g. `(n) => \`<pb n="${n}"/>\``).
 */
export const resolvePageBreakMarkers = (
  text: string,
  escape: (value: string) => string,
  pb: (n: string) => string,
): { soleMarker: string } | { text: string } => {
  const soleMatch = text.match(SOLE_PAGE_NUMBER_MARKER_RE);
  if (soleMatch) return { soleMarker: pb(soleMatch[1]) };

  const escaped = escape(text);
  return { text: escaped.replace(PAGE_NUMBER_MARKER_RE, (_match, n: string) => pb(n)) };
};
