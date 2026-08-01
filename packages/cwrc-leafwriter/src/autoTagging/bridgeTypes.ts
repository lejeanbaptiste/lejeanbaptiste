/** Shared result shapes for Bridge promote / adopt (SQLite path). */

export interface PromoteResult {
  centralId: string;
  /** True when a new central record was minted; false when an existing one was matched/linked. */
  created: boolean;
  /** True when the concordance row was written or changed. */
  linked: boolean;
}

export interface AdoptResult {
  pedbId: string;
  /** True when a new project record was minted; false when an already-linked one was reused. */
  created: boolean;
}
