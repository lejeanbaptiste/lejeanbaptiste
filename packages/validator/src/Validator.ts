import { InitializeOptions } from './conversion';
import { GetValidTagsAtParameters } from './possible';
import { ValidationResponse } from './validate';
import { virtualEditor } from './virtualEditor';

const Validator = {
  async initialize(options: InitializeOptions) {
    return await virtualEditor.initialize(options);
  },
  validate(documentString: string, callback: (value: ValidationResponse) => void) {
    return virtualEditor.validate(documentString, callback);
  },
  async getTagAt(tagName: string, parentXpath: string, index?: number) {
    return await virtualEditor.getTagAt(tagName, parentXpath, index);
  },
  async getElementsForTagAt(xpath: string, index?: number) {
    return await virtualEditor.getElementsForTagAt(xpath, index);
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
  async getValidTagsAt(parameters: GetValidTagsAtParameters) {
    return await virtualEditor.getValidTagsAt(parameters);
  },
  async hasValidator() {
    return virtualEditor.hasValidator();
  },
  async reset() {
    return virtualEditor.reset();
  },
};

export default Validator;
