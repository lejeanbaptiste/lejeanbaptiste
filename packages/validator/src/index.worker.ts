import * as salve from '@cwrc/salve-leafwriter';
import * as Comlink from 'comlink';
//@ts-ignore
import jsdom from './lib/jsdom/jsdom-browserified';
import { log, LOG_PREFIX } from './log';
import Validator from './Validator';

export type {
  EventName,
  InitializeParameters,
  InitializeResponse,
  NodeDetail,
  NodeType,
  PossibleNodesAt,
  PossibleNodesAtOptions,
  Target,
  TargetSelection,
} from './types';
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

log.info(LOG_PREFIX, 'WORKER READY');

export type Validator = typeof Validator;

Comlink.expose(Validator);
