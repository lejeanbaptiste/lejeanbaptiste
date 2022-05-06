export type ElementType = 'node' | 'tag' | 'attribute' | 'attributeValue';
export interface ElementDetail {
  name: string;
  type: ElementType;
  documentation?: string;
  fullName?: string;
  ns?: string;
}
