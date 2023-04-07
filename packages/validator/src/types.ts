export interface CachedSchema {
  createdAt: Date;
  gramarJson: string;
  hash: string;
  id: string;
  simplified?: any;
  url: string;
  warnings?: string[];
}

export type EventName =
  | 'attributeName'
  | 'attributeValue'
  | 'endTag'
  | 'enterStartTag'
  | 'leaveStartTag'
  | 'text';

export interface InitializeParameters {
  id: string;
  url: string;
  shouldCache?: boolean;
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
