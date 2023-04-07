import { WorkingState, type ErrorData, type WorkingStateData } from '@cwrc/salve-dom-leafwriter';
import type { EventSet, Name } from '@cwrc/salve-leafwriter';
import { sortBy, uniqBy } from 'lodash';
import { logEnabledFor } from './log';
import type { EventName, NodeDetail } from './types';
import { getFullNameFromDocumentation, getXPathForElement } from './utilities';
import VirtualEditor from './virtualEditor';

export type ErrorNames =
  | 'AttributeNameError'
  | 'AttributeValueError'
  | 'ElementNameError'
  | 'ChoiceError'
  | 'ValidationError';

export interface ValidationErrorTarget {
  xpath?: string;
  index?: number;
  isAttr: boolean;
  name?: string;
  ns?: string;
  documentation?: string;
  fullName?: string;
}

export interface ValidationErrorElement {
  xpath?: string;
  name?: string;
  documentation?: string;
  fullName?: string;
  parentElementName?: string;
  parentElementXpath?: string;
  parentElementIndex?: number;
}

export interface ValidationError {
  type?: ErrorNames;
  msg: string;
  target: ValidationErrorTarget;
  element?: ValidationErrorElement;
}

export interface ValidationResponse {
  state: WorkingState;
  partDone?: number;
  valid?: boolean;
  errors?: ValidationError[];
}

const ERROR_TYPES: Map<string, ErrorNames> = new Map();
ERROR_TYPES.set('AttributeNameError', 'AttributeNameError');
ERROR_TYPES.set('AttributeValueError', 'AttributeValueError');
ERROR_TYPES.set('ElementNameError', 'ElementNameError');
ERROR_TYPES.set('ChoiceError', 'ChoiceError');
ERROR_TYPES.set('ValidationError', 'ValidationError');
ERROR_TYPES.set('attribute not allowed here', 'AttributeNameError');
ERROR_TYPES.set('invalid attribute value', 'AttributeValueError');
ERROR_TYPES.set('tag not allowed here', 'ElementNameError');
ERROR_TYPES.set('one value required from the following', 'ChoiceError'); //this might not work
ERROR_TYPES.set('text not allowed here', 'ValidationError');

export const validate = (
  vEditor: VirtualEditor,
  callback?: (workingStateData: ValidationResponse) => void
) => {
  if (logEnabledFor('DEBUG')) console.time('Validate Document');

  vEditor.validator?.events.addEventListener('error', () => {
    //TODO Informe progress to the UI
  });

  vEditor.validator?.events.addEventListener('state-update', (event) => {
    const workingStateData = handleValidatorStateUpdate(vEditor, event);
    if (callback) callback(workingStateData);
  });

  vEditor.startValidator();
};

const handleValidatorStateUpdate = (
  vEditor: VirtualEditor,
  { partDone, state }: WorkingStateData
): ValidationResponse => {
  if (!vEditor.validator) throw new Error('Validator is not set');
  //* state [1] INCOMPLETE: Doesn't happens here because validator runs without timeout
  //* State [2] WORKING: Keep updating the main thread;
  if (state === WorkingState.INCOMPLETE || state === WorkingState.WORKING) {
    return { partDone, state };
  }

  // if (!validator) throw new Error('vEditor: Validator not set');
  const valid = vEditor.validator.errors.length > 0 ? false : true;

  //* State [4] VALID: Resolve
  if (state === WorkingState.VALID) {
    vEditor.validator.events.removeAllListeners('state-update');
    if (logEnabledFor('DEBUG')) console.timeEnd('Validate Document');
    return { partDone, state, valid };
  }

  //* State [3] INVALID: Process errors and Resolve
  const errors: ValidationError[] = vEditor.validator.errors.map((errorData) =>
    parseErrors(vEditor, errorData)
  );

  vEditor.validator.events.removeAllListeners('state-update');
  if (logEnabledFor('DEBUG')) console.timeEnd('Validate Document');

  return { errors, partDone, state, valid };
};

const parseErrors = (
  vEditor: VirtualEditor,
  { error, index, node }: ErrorData
): ValidationError => {
  if (!vEditor.document || !vEditor.validator) {
    throw new Error('vEditor: Document or Validator not set');
  }

  const type = ERROR_TYPES.get(error.msg) ?? ERROR_TYPES.get('ValidationError');
  const msg = error.msg;

  const target: ValidationErrorTarget = {
    index,
    isAttr: type === 'AttributeNameError' ? true : false,
  };

  if ('name' in error) {
    const errorName = error.name as Name;
    target.name = errorName.name;
    target.ns = errorName.ns;
    target.documentation = errorName.documentation
      ? errorName.documentation
      : vEditor.getDocumentation(target.name);
    target.fullName = getFullNameFromDocumentation(target.documentation);
  }

  if (!node) return { type, msg, target };

  const element: ValidationErrorElement = {};

  const elementNode =
    type === 'AttributeNameError' || type === 'AttributeValueError'
      ? //@ts-ignore
        node.ownerElement
      : node;

  element.name = elementNode.nodeName;
  element.documentation = element.name ? vEditor.getDocumentation(element.name) : '';
  element.fullName = getFullNameFromDocumentation(element.documentation);
  element.xpath = getXPathForElement(elementNode, vEditor.document);

  if (type === 'ElementNameError') {
    target.xpath = `${element.xpath}/${target.name}`;
  }

  if (type === 'AttributeNameError' || type === 'AttributeValueError') {
    target.xpath = `${element.xpath}/@${target.name}`;
  }

  if (type === 'AttributeNameError') {
    const parentElement = elementNode.parentElement ?? elementNode;
    element.parentElementName = parentElement.nodeName;
    element.parentElementXpath = getXPathForElement(parentElement, vEditor.document);

    //index of element that holds the attribute
    const index = Array.from(parentElement.childNodes).findIndex((child) => child === elementNode);
    element.parentElementIndex = index;
  }

  return { type, msg, target, element };
};

export const parseValidatorEvents = (
  events: EventSet,
  options: { only?: EventName[]; skip?: EventName[] }
) => {
  let nodes: NodeDetail[] = [];

  const { only, skip } = options;
  const skipEvents = new Set([...(skip ?? [])]);
  const onlyEvents = new Set([...(only ?? [])]);

  Array.from(events).forEach((event) => {
    if (skipEvents.has(event.name) && !onlyEvents.has(event.name)) return;

    if (event.name === 'text') {
      const { name, value } = event;
      nodes.push({ eventType: name, fullName: '#text', name, type: name, value });
      return;
    }

    if (event.name === 'enterStartTag' || event.name === 'attributeName') {
      if (event.namePattern.kind !== 'Name') return;

      const { documentation, name, ns } = event.namePattern;
      const fullName = getFullNameFromDocumentation(documentation);
      const type = event.isAttributeEvent ? 'attribute' : 'tag';

      nodes.push({ documentation, eventType: event.name, fullName, name, ns, type });
      return;
    }

    if (event.name === 'attributeValue') {
      const { documentation, name, value } = event;
      const fullName = getFullNameFromDocumentation(documentation);
      nodes.push({
        documentation,
        eventType: name,
        fullName,
        name: value as string,
        type: name,
        value: value,
      });
      return;
    }

    if (event.name === 'leaveStartTag' || event.name === 'endTag') {
      const { name } = event;
      nodes.push({ eventType: name, name, type: 'tag' });
      return;
    }
  });

  nodes = uniqBy(nodes, 'name');
  nodes = sortBy(nodes, ['type', 'name']);

  return nodes;
};
