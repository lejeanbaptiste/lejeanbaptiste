/**
 * Multi-string matcher for firing a large dictionary at text in a single pass.
 *
 * The naive approach — scan the whole document once per pattern (indexOf or
 * regex per row) — is O(patterns × text) and does not scale to authority sets
 * with hundreds of thousands of names. Instead we hash every pattern into
 * buckets by length, then walk the text once: at each position we test only
 * the distinct pattern *lengths* (a handful, since names are short), doing an
 * O(1) set lookup for each. Scan cost is O(text × distinctLengths) —
 * independent of the number of patterns.
 *
 * Matches are non-overlapping and leftmost-longest, which is the "prefer the
 * longer span" conflict rule: at each position the longest pattern that starts
 * there wins, and the scan resumes after it.
 */
export interface StringMatch {
  start: number;
  end: number;
  pattern: string;
}

export class MultiStringMatcher {
  private readonly byLength = new Map<number, Set<string>>();
  /** Distinct pattern lengths, longest first (drives leftmost-longest). */
  private readonly lengthsDesc: number[];
  readonly size: number;

  constructor(patterns: Iterable<string>) {
    let count = 0;
    for (const pattern of patterns) {
      if (!pattern) continue;
      const len = pattern.length;
      let bucket = this.byLength.get(len);
      if (!bucket) {
        bucket = new Set<string>();
        this.byLength.set(len, bucket);
      }
      if (!bucket.has(pattern)) {
        bucket.add(pattern);
        count += 1;
      }
    }
    this.size = count;
    this.lengthsDesc = [...this.byLength.keys()].sort((a, b) => b - a);
  }

  /** Yield non-overlapping, leftmost-longest matches within `text`. */
  *scan(text: string): Generator<StringMatch> {
    const n = text.length;
    let i = 0;
    while (i < n) {
      let advanced = false;
      for (const len of this.lengthsDesc) {
        if (i + len > n) continue;
        const candidate = text.slice(i, i + len);
        if (this.byLength.get(len)!.has(candidate)) {
          yield { start: i, end: i + len, pattern: candidate };
          i += len; // non-overlapping: resume after the match
          advanced = true;
          break;
        }
      }
      if (!advanced) i += 1;
    }
  }
}
