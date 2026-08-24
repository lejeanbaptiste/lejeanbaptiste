/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as salve from '@cwrc/salve-leafwriter';
import * as Comlink from 'comlink';
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
//@ts-expect-error
self.window = DOM.window as Window;
//@ts-expect-error
self.salve = salve;

log.info(LOG_PREFIX, 'WORKER READY');

export type ValidatorType = typeof Validator;

Comlink.expose(Validator);
