export declare const setSchemaJSON: (json: any) => void;
export declare const setSchemaElements: (elements: any) => void;
/**
 * Returns an array of valid parents for a particular tag
 * @param {String} tag The element name
 * @returns {Array}
 */
export declare const getParentsForTag: (tag: string) => {
    name: string;
    level: number;
}[];
/**
 * Returns an array of valid parents for a particular path
 * @param {String} path The path
 * @returns {Array}
 */
export declare const getParentsForPath: (path: string) => {
    name: string;
    level: number;
}[];
/**
 * Returns an array of valid children for a particular tag
 * @param {String} tag The element name
 * @returns {Array}
 */
export declare const getChildrenForTag: (tag: string) => any[];
/**
 * Returns an array of valid children for a particular path
 * @param {String} path The path
 * @returns {Array}
 */
export declare const getChildrenForPath: (path: string) => any[];
/**
 * Returns an array of valid attributes for a particular tag
 * @param {String} tag The element name
 * @returns {Array}
 */
export declare const getAttributesForTag: (tag: string) => any[];
/**
 * Returns an array of valid attributes for a particular path
 * @param {String} path The path
 * @returns {Array}
 */
export declare const getAttributesForPath: (path: string) => any[];
//# sourceMappingURL=schemaNavigator.d.ts.map