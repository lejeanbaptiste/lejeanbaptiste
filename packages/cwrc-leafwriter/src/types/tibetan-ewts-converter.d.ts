declare module 'tibetan-ewts-converter' {
  /** Tibetan Unicode ⇄ EWTS (Wylie) converter. Only the methods we use are declared. */
  export class EwtsConverter {
    constructor(options?: { check?: boolean; check_strict?: boolean; fix_spacing?: boolean });
    to_ewts(unicode: string): string;
    to_unicode(ewts: string, keep?: unknown): string;
  }
}
