declare class ObjTree {
  static VERSION: string;

  attr_prefix: string;
  overrideMimeType: string;
  unchanged: boolean;
  force_array?: string[];

  parseXML(xml: string): unknown;
  parseHTTP(url: string, options: Record<string, unknown>, callback?: (...args: unknown[]) => void): unknown;
  parseDOM(root: Node | Document): unknown;
  parseElement(elem: Element): unknown;
  addNode(hash: Record<string, unknown>, key: string, cnts: unknown, val: unknown): void;
  writeXML(tree: unknown): string;
  hash_to_xml(name: string, tree: unknown): string;
  array_to_xml(name: string, array: unknown[]): string;
  scalar_to_xml(name: string, text: unknown): string;
  xml_escape(text: unknown): string;
}

export default ObjTree;
