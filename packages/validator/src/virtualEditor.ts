import { safeParse, Validator } from '@cwrc/salve-dom-leafwriter';
import { EventSet, Grammar /* , GrammarWalker, NameResolver */ } from '@cwrc/salve-leafwriter';
import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/unionBy';
import { initialize } from './conversion';
import { logEnabledFor } from './log';
import { speculateAt } from './speculate';
import type {
  EventName,
  NodeDetail,
  PossibleNodesAt,
  PossibleNodesAtOptions,
  Target,
} from './types';
import { evaluateXPath, getFullNameFromDocumentation } from './utils';
import { validate, ValidationResponse } from './validate';

export interface InitializeOptions {
  cachedSchema?: string;
  createManifest?: boolean;
  id: string;
  url: string;
}

class VirtualEditor {
  private readonly validatorPrefix: string;

  // id: string;
  schemaId?: string;
  schema?: Grammar;
  // private walker?: GrammarWalker<NameResolver>;
  document?: Document;
  validator?: Validator;

  constructor() {
    this.validatorPrefix = 'lw';
  }

  async initialize(options: InitializeOptions) {
    if (this.schemaId === options.id) return { status: 'Already loaded' };
    const response = await initialize(this, options);
    return response;
  }

  validate(documentString: string, callback?: (workingStateData: ValidationResponse) => void) {
    this.document = this.setDocument(documentString);
    this.setValidator();
    if (!this.validator) return;

    validate(this, callback);
  }

  setDocument(documentString: string) {
    this.document = safeParse(documentString, window);
    return this.document;
  }

  setValidator() {
    if (!this.document || !this.schema) throw new Error('vEditor: Document or schema not set');

    const validator: Validator = new Validator(this.schema, this.document, {
      prefix: this.validatorPrefix,
      timeout: 0,
      maxTimespan: 0,
    });

    this.validator = validator;

    return this.validator;
  }

  hasValidator() {
    return this.validator ? true : false;
  }

  startValidator() {
    this.validator?.start();
    return this.validator;
  }

  stopValidator() {
    this.validator?.stop();
    return this.validator;
  }

  async getTagAt(tagName: string, parentXpath: string, index: number = 0) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`getTagAt: ${tagName} at ${parentXpath}:${index}`);
      console.time('Timer');
    }

    const container = this.evaluateXPath(parentXpath);
    if (!container) return;

    const possibleEventsAt = this.validator.possibleAt(container, index);
    const nodes = this.parseValidatorEvents(possibleEventsAt, {
      only: ['enterStartTag'],
    });

    const tag = nodes.find((attr) => attr.name === tagName);

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Timer');
      console.groupEnd();
    }

    return tag;
  }

  async getNodesForTagAt(xpath: string, index: number = 0) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`getNodesForTagAt: ${xpath}:${index}`);
      console.time('Get nodes for Tag');
    }

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleEventsAt: EventSet = this.validator.possibleAt(container, index, false);
    const nodes = this.parseValidatorEvents(possibleEventsAt, {
      only: ['text', 'enterStartTag'],
    });

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Get nodes for Tag');
      console.groupEnd();
    }

    return nodes;
  }

  async getAttributesForTagAt(xpath: string, index: number = 1) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`getAttributesForTagAt: ${xpath}:${index}`);
      console.time('Timer');
    }

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleEventsAt: EventSet = this.validator.possibleAt(container, index, true);
    const atttibutes = this.parseValidatorEvents(possibleEventsAt, {
      only: ['attributeName'],
    });

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Timer');
      console.groupEnd();
    }

    return atttibutes;
  }

  async getTagAttributeAt(attributeName: string, parentXpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`get tag ${attributeName} at ${parentXpath}`);
      console.time('Timer');
    }

    const container = this.evaluateXPath(parentXpath);
    if (!container) return;

    const possibleEventsAt: EventSet = this.validator.possibleAt(container, 1, true);
    const attributes = this.parseValidatorEvents(possibleEventsAt, {
      only: ['attributeName'],
    });

    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Timer');
      console.groupEnd();
    }

    return attribute;
  }

  async getValuesForTagAttributeAt(xpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) console.time(`Get value for tag attribute at ${xpath}`);

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleEventsAt = this.validator.possibleAt(container, 1, false);
    const attributeValues = this.parseValidatorEvents(possibleEventsAt, {
      only: ['attributeValue'],
    });

    if (logEnabledFor('DEBUG')) console.timeEnd('Get Value for Tag Attribute');

    return attributeValues;
  }

  async getPossibleNodesAt(
    target: Target,
    options: PossibleNodesAtOptions = { speculativeValidate: true }
  ) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    const { index, xpath, selection } = target;
    const { speculativeValidate } = options;

    const _type = selection ? ` - ${selection.type}` : '';
    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`PosssibleAt: ${xpath}${_type}`);
      console.time(`PosssibleAt: ${xpath}${_type}`);
    }

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleEventsAt = this.validator.possibleAt(container, index);
    let possibleNodes = this.parseValidatorEvents(possibleEventsAt, {
      skip: ['leaveStartTag', 'endTag'],
    });

    if (speculativeValidate) {
      const speculativeNode = speculateAt(
        { document: this.document, validator: this.validator },
        { container, index, possibleNodes, selection }
      );
      possibleNodes = speculativeNode;
    }

    if (logEnabledFor('DEBUG')) {
      console.timeEnd(`PosssibleAt: ${xpath}${_type}`);
      console.groupEnd();
    }

    const result: PossibleNodesAt = { target, nodes: possibleNodes };
    return result;
  }

  async getValidNodesAt(target: Target) {
    const possibleNodes = await this.getPossibleNodesAt(target, { speculativeValidate: true });
    if (!possibleNodes) return;
    possibleNodes.nodes = possibleNodes.nodes.filter((node) => !node.invalid);
    return possibleNodes;
  }

  getDocumentation(tagName: string): string {
    if (!this.schema) throw new Error('schema is not set');

    //@ts-ignore
    const definitions = Array.from(this.schema.definitions.values());
    const definition: any = definitions.find((def: any) => def.pat?.name?.name === tagName);

    const documentation = definition
      ? definition.pat.name.documentation
      : 'Element undefined or documentation unavailable';

    return documentation;
  }

  reset() {
    this.stopValidator();
    this.schemaId = undefined;
    this.schema = undefined;
    // this.walker = undefined;
    this.document = undefined;
    this.validator = undefined;

    return this;
  }

  private parseValidatorEvents(
    events: EventSet,
    options: { only?: EventName[]; skip?: EventName[] }
  ) {
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
  }

  private evaluateXPath(xpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    return evaluateXPath(xpath, this.document);
  }
}

export const virtualEditor = new VirtualEditor();

export default VirtualEditor;
