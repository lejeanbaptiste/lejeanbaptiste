export interface CachedSchema {
  createdAt: Date;
  gramarJson: string;
  hash: string;
  id: string;
  maxAge?: number; // in milliseconds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  simplified?: any;
  url: string;
  warnings?: string[];
}

export type EventName =
  'attributeName' | 'attributeValue' | 'endTag' | 'enterStartTag' | 'leaveStartTag' | 'text';

export interface InitializeParameters {
  id: string;
  /** Stable schema locator (http(s) URL or ljb:// path). Used for cache keys and change detection. */
  url: string;
  shouldCache?: boolean;
  /** On-disk content fingerprint (e.g. sanmiao merge version). */
  schemaRevision?: string | null;
  /**
   * When set, compile from this RelaxNG text inside the worker. Required for
   * desktop project files: blob URLs created on the main thread are not
   * fetchable from the validator web worker.
   */
  schemaText?: string;
}

export interface InitializeResponse {
  error?: Error;
  success: boolean;
}

export interface NodeDetail {
  documentation?: string;
  eventType: EventName;
  fullName?: string;
  invalid?: boolean;
  name: string;
  ns?: string;
  type: NodeType;
  value?: string | RegExp;
  /** Extra attributes to stamp when this suggestion is applied (e.g. `{ type: 'medicinal_plant' }`), overriding the tag's default attributes. Set only on synthetic, non-schema-derived suggestions. */
  attributeOverrides?: Record<string, string>;
  /** Display label shown instead of `.name` — for a synthetic suggestion whose raw tag name isn't meaningful on its own (e.g. several thing sub-types all named `rs`). */
  displayLabel?: string;
}

export type NodeType = 'attribute' | 'attributeValue' | 'tag' | 'text';

export interface PossibleNodesAt {
  nodes: NodeDetail[];
  target: Target;
}

export interface PossibleNodesAtOptions {
  speculativeValidate?: boolean;
}

export type SelectionType = 'after' | 'around' | 'before' | 'change' | 'inside' | 'span';

export interface Target {
  index: number;
  selection?: TargetSelection;
  xpath: string;
}

export interface TargetSelection {
  containerIndex?: number;
  endContainerIndex?: number;
  endOffset?: number;
  startContainerIndex?: number;
  startOffset?: number;
  skip?: string;
  type: SelectionType;
  xpath?: string;
}
