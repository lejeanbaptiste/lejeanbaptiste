import type { InitializeOptions } from './conversion';
import type { PossibleNodesAtOptions, Target } from './types';
import type { ValidationResponse } from './validate';
import { virtualEditor } from './virtualEditor';

const Validator = {
  async initialize(options: InitializeOptions) {
    return await virtualEditor.initialize(options);
  },
  validate(documentString: string, callback?: (value: ValidationResponse) => void) {
    return virtualEditor.validate(documentString, callback);
  },
  async getTagAt(tagName: string, parentXpath: string, index?: number) {
    return await virtualEditor.getTagAt(tagName, parentXpath, index);
  },
  async getNodesForTagAt(xpath: string, index?: number) {
    return await virtualEditor.getNodesForTagAt(xpath, index);
  },
  async getAttributesForTagAt(xpath: string, index?: number) {
    return await virtualEditor.getAttributesForTagAt(xpath, index);
  },
  async getTagAttributeAt(attributeName: string, parentXpath: string) {
    return await virtualEditor.getTagAttributeAt(attributeName, parentXpath);
  },
  async getValuesForTagAttributeAt(xpath: string) {
    return await virtualEditor.getValuesForTagAttributeAt(xpath);
  },
  async getPossibleNodesAt(parameters: Target, options?: PossibleNodesAtOptions) {
    return await virtualEditor.getPossibleNodesAt(parameters, options);
  },
  async getValidNodesAt(parameters: Target) {
    return await virtualEditor.getValidNodesAt(parameters);
  },
  async hasValidator() {
    return virtualEditor.hasValidator();
  },
  async reset() {
    return virtualEditor.reset();
  },
};

export default Validator;
