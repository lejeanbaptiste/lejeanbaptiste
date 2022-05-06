import * as salve from '@cwrc/salve-leafwriter';
import * as Comlink from 'comlink';
//@ts-ignore
import jsdom from './lib/jsdom/jsdom-browserified';
import Validator from './Validator';

export type { InitializeOptions, InitializeResponse } from './conversion';
export type {
  GetValidTagsAtParameters,
  GetValidTagsAtParametersSelection,
  GetValidTagsAtResponse,
} from './possible';
export type { ElementDetail, ElementType } from './sharedTypes';
export type {
  ErrorNames,
  ValidationError,
  ValidationErrorElement,
  ValidationErrorTarget,
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

export type Validator = typeof Validator;

Comlink.expose(Validator);
