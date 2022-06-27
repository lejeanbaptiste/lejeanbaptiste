export = ObjTree;
declare class ObjTree {
    xmlDecl: string;
    attr_prefix: string;
    overrideMimeType: string;
    unchanged: boolean;
    parseXML(xml: any): any;
    parseHTTP(url: any, options: any, callback: any): any;
    parseDOM(root: any): any;
    __force_array: {};
    parseElement(elem: any): any;
    addNode(hash: any, key: any, cnts: any, val: any): void;
    writeXML(tree: any): string;
    hash_to_xml(name: any, tree: any): any;
    array_to_xml(name: any, array: any): any;
    scalar_to_xml(name: any, text: any): string;
    xml_escape(text: any): string;
}
//# sourceMappingURL=ObjTree.d.ts.map