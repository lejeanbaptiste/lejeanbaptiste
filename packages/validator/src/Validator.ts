import { clearCache } from './db';
import type { InitializeParameters, PossibleNodesAtOptions, Target } from './types';
import type { ValidationResponse } from './validate';
import { virtualEditor } from './virtualEditor';

const Validator = {
  async initialize(params: InitializeParameters) {
    return await virtualEditor.initialize(params);
  },
  validate(documentString: string, callback?: (value: ValidationResponse) => void) {
    return virtualEditor.validate(documentString, callback);
  },
  hasValidator() {
    return virtualEditor.hasValidator();
  },
  async getAttributesForTagAt(xpath: string, index?: number) {
    return await virtualEditor.getAttributesForTagAt(xpath, index);
  },
  async getNodesForTagAt(xpath: string, index?: number) {
    return await virtualEditor.getNodesForTagAt(xpath, index);
  },
  async getPossibleNodesAt(parameters: Target, options?: PossibleNodesAtOptions) {
    return await virtualEditor.getPossibleNodesAt(parameters, options);
  },
  async getTagAt(tagName: string, parentXpath: string, index?: number) {
    return await virtualEditor.getTagAt(tagName, parentXpath, index);
  },
  async getTagAttributeAt(attributeName: string, parentXpath: string) {
    return await virtualEditor.getTagAttributeAt(attributeName, parentXpath);
  },
  async getValidNodesAt(parameters: Target) {
    return await virtualEditor.getValidNodesAt(parameters);
  },
  async getValuesForTagAttributeAt(xpath: string) {
    return await virtualEditor.getValuesForTagAttributeAt(xpath);
  },
  reset() {
    virtualEditor.reset();
  },
  async clearCache() {
    await clearCache();
  },
};

export default Validator;
