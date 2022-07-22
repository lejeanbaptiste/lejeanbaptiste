import type { GetValidTagsAtParameters, Validator } from '@cwrc/leafwriter-validator';
import * as Comlink from 'comlink';
import { Context } from '../';
import Writer from '../../js/Writer';
declare global {
    interface Window {
        leafwriterValidator: Comlink.Remote<Validator>;
        writer: Writer;
    }
}
export declare const loadValidator: ({ state }: Context) => Promise<void>;
export declare const initialize: ({ state }: Context) => Promise<void>;
export declare const validate: ({ state }: Context) => Promise<void>;
declare type GetAtAction = 'TagAt' | 'ElementsForTagAt' | 'AttributesForTagAt' | 'AttributeAt' | 'ValuesForTagAttributeAt';
export declare const getAt: ({ actions }: Context, { action, attributeName, index, parentXpath, tagName, xpath, }: {
    action: GetAtAction;
    attributeName?: string;
    index?: number;
    parentXpath?: string;
    tagName?: string;
    xpath?: string;
}) => Promise<import("@cwrc/leafwriter-validator").ElementDetail | import("@cwrc/leafwriter-validator").ElementDetail[]>;
export declare const getTagAt: ({ state }: Context, { tagName, parentXpath, index }: {
    tagName: string;
    parentXpath: string;
    index?: number;
}) => Promise<import("@cwrc/leafwriter-validator").ElementDetail>;
export declare const getElementsForTagAt: ({ state }: Context, { xpath, index }: {
    xpath: string;
    index?: number;
}) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
export declare const getAttributesForTagAt: ({ state }: Context, { xpath, index }: {
    xpath: string;
    index?: number;
}) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
export declare const getTagAttributeAt: ({ state }: Context, { attributeName, parentXpath }: {
    attributeName: string;
    parentXpath: string;
}) => Promise<import("@cwrc/leafwriter-validator").ElementDetail>;
export declare const getValuesForTagAttributeAt: ({ state }: Context, { xpath }: {
    xpath: string;
}) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
export declare const getValidTagsAt: ({ state }: Context, params: GetValidTagsAtParameters) => Promise<import("@cwrc/leafwriter-validator").ElementDetail[]>;
export declare const clear: ({ state }: Context) => void;
export {};
//# sourceMappingURL=actions.d.ts.map