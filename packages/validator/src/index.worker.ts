import * as salve from '@cwrc/salve-leafwriter';
import * as Comlink from 'comlink';
import { loadSchema, SchemaRequest } from './conversion';
//@ts-ignore
import jsdom from './lib/jsdom/jsdom-browserified';
import { possibleAt, PossibleRequest } from './possible';
import { attributesForTag, tagAt, TagRequest } from './tag';
import { validate, validatePossibleAt, ValidationResponse } from './validate';
import { virtualEditor } from './virtualEditor';

export type { SchemaRequest, SchemaResponse } from './conversion';
export type { PossibleRequest, PossibleResponse, Selection } from './possible';
export type { Tag } from './sharedTypes';
export type { TagAttribute, TagRequest } from './tag';
export type {
  PossibleNodes,
  ValidatePossibleAtResponse,
  ValidationNode,
  ValidationNodeElement,
  ValidationNodeTarget,
  ValidationResponse,
} from './validate';

//INITIALIZE
const { JSDOM } = jsdom;
const DOM = new JSDOM('<!DOCTYPE html><p>_</p></html>');
//@ts-ignore
self.window = DOM.window as Window;
//@ts-ignore
self.salve = salve;

console.info('WORKER VALIDATOR READY');

const validator = {
  async loadSchema(schema: SchemaRequest) {
    return await loadSchema(schema);
  },
  validate(documentString: string, callback: (value: ValidationResponse) => void) {
    return validate(documentString, callback);
  },
  async validatePossible(xpath: string, index: number, type: string) {
    return await validatePossibleAt(xpath, index, type);
  },
  async tagAt(tag: TagRequest) {
    return await tagAt(tag);
  },
  async attributesForTag(xpath: string, index?: number) {
    return await attributesForTag(xpath, index);
  },
  hasValidator() {
    return virtualEditor.hasValidator();
  },
  async possibleAtContextMenu(parameters: PossibleRequest) {
    return await possibleAt(parameters);
  },
};

export type Validator = typeof validator;

Comlink.expose(validator);
