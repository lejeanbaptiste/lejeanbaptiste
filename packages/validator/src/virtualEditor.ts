import { safeParse, Validator } from '@cwrc/salve-dom-leafwriter';
import {
  AttributeNameEvent,
  EndTagEvent,
  EnterStartTagEvent,
  EventSet,
  Grammar /* , GrammarWalker, NameResolver */,
  Name,
  TextEvent,
} from '@cwrc/salve-leafwriter';
import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/unionBy';
import { initialize } from './conversion';
import { GetValidTagsAtParameters, GetValidTagsAtResponse, speculateAt } from './possible';
import { ElementDetail } from './sharedTypes';
import { evaluateXPath, getFullNameFromDocumentation } from './utils';
import { validate, ValidationResponse } from './validate';

export interface InitializeOptions {
  id: string;
  url: string;
  cachedSchema?: string;
  createManifest?: boolean;
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

    console.groupCollapsed(`getTagAt: ${tagName} at ${parentXpath}:${index}`);
    console.time('Timer');

    const container = this.evaluateXPath(parentXpath);
    if (!container) return;

    const possibleAt = this.validator.possibleAt(container, index);

    const event = Array.from(possibleAt).find((event) => {
      return (
        event.name === 'enterStartTag' &&
        'name' in event.namePattern &&
        event.namePattern.name === tagName
      );
    }) as EnterStartTagEvent;

    if (!event) return;

    const { documentation, name, ns } = event.namePattern as Name;
    const fullName = getFullNameFromDocumentation(documentation);

    const tag: ElementDetail = { type: 'tag', name, documentation, fullName, ns };

    console.timeEnd('Timer');
    console.groupEnd();

    return tag;
  }
  async getElementsForTagAt(xpath: string, index: number = 0) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    console.groupCollapsed(`getElementsForTagAt: ${xpath}:${index}`);
    console.time('Get elements for Tag');

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleAt: EventSet = this.validator.possibleAt(container, index, false);

    //Pepare to store possible events
    let elements: ElementDetail[] = [];

    Array.from(possibleAt).forEach((event) => {
      const SKIP_EVENTS = new Set(['leaveStartTag']);
      if (SKIP_EVENTS.has(event.name)) return;

      //get events for text or endtags, since they have less information
      if (event.name === 'text' || event.name === 'endTag') {
        const ev: EndTagEvent | TextEvent = event as EndTagEvent | TextEvent;
        elements.push({ type: 'node', name: ev.name });
        return;
      }

      if ('namePattern' in event && 'name' in event.namePattern) {
        const { name, documentation, ns } = event.namePattern;
        const fullName = getFullNameFromDocumentation(documentation);
        elements.push({ type: 'tag', name, fullName, documentation, ns });
        return;
      }
    });

    //remove duplicates and sort alphabetacally;
    if (elements.length > 0) {
      elements = uniqBy(elements, 'name');
      elements = sortBy(elements, ['name']);
    }

    console.timeEnd('Get elements for Tag');
    console.groupEnd();

    return elements;
  }

  async getAttributesForTagAt(xpath: string, index: number = 1) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    console.groupCollapsed(`getAttributesForTagAt: ${xpath}:${index}`);
    console.time('Timer');

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleAt: EventSet = this.validator.possibleAt(container, index, true);

    let atttibutes: ElementDetail[] = [];

    Array.from(possibleAt).forEach((event) => {
      if ('namePattern' in event && 'name' in event.namePattern) {
        const { name, ns, documentation } = event.namePattern;
        const fullName = getFullNameFromDocumentation(documentation);
        atttibutes.push({ type: 'attribute', name, ns, fullName, documentation });
      }
    });

    if (atttibutes.length > 0) {
      atttibutes = uniqBy(atttibutes, 'name');
      atttibutes = sortBy(atttibutes, ['name']);
    }

    console.timeEnd('Timer');
    console.groupEnd();

    return atttibutes;
  }
  async getTagAttributeAt(attributeName: string, parentXpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    console.groupCollapsed(`get tag ${attributeName} at ${parentXpath}`);
    console.time('Timer');

    const container = this.evaluateXPath(parentXpath);
    if (!container) return;

    const possibleAt: EventSet = this.validator.possibleAt(container, 1, true);

    const event = Array.from(possibleAt).find((event) => {
      return (
        event.name === 'attributeName' &&
        'name' in event.namePattern &&
        event.namePattern.name === attributeName
      );
    }) as AttributeNameEvent;

    if (!event) return;

    const { documentation, name, ns } = event.namePattern as Name;
    const fullName = getFullNameFromDocumentation(documentation);

    const attribute: ElementDetail = { type: 'attribute', name, documentation, fullName, ns };

    console.timeEnd('Timer');
    console.groupEnd();

    return attribute;
  }
  async getValuesForTagAttributeAt(xpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    console.time(`Get value for tag attribute at ${xpath}`);

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleAt: EventSet = this.validator.possibleAt(container, 1, false);

    const attrValues: ElementDetail[] = [];

    Array.from(possibleAt).forEach((event) => {
      if (event.name === 'attributeValue') {
        const name = event.value as string;
        attrValues.push({ type: 'attributeValue', name });
      }
    });

    console.timeEnd('Get Value for Tag Attribute');

    return attrValues;
  }

  async getValidTagsAt({ index, xpath, selection, speculate = true }: GetValidTagsAtParameters) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    const _type = selection ? ` - ${selection.type}` : '';
    console.groupCollapsed(`ValidAt: ${xpath}${_type}`);
    console.time('Timer');

    const container = this.evaluateXPath(xpath);
    if (!container) return;

    const possibleAt: EventSet = this.validator.possibleAt(container, index);
    const possibleTags = this.storePossibleTags(possibleAt);

    const result: GetValidTagsAtResponse = { index, possible: possibleTags, xpath };

    if (speculate) {
      const speculativeTags = speculateAt(this, { container, index, possibleTags, selection });
      result.speculative = speculativeTags;
    }

    console.timeEnd('Timer');
    console.groupEnd();

    return result;
  }

  private storePossibleTags(possibleAt: EventSet) {
    const skipEvent = new Set(['leaveStartTag', 'endTag', 'text']);
    let possibleTags: ElementDetail[] = [];

    Array.from(possibleAt).forEach((event) => {
      if (skipEvent.has(event.name)) return;

      if ('namePattern' in event && 'name' in event.namePattern) {
        const { name, documentation } = event.namePattern;
        const fullName = getFullNameFromDocumentation(documentation);
        possibleTags.push({ type: 'tag', name, fullName });
      }
    });

    possibleTags = uniqBy(possibleTags, 'name');
    possibleTags = sortBy(possibleTags, ['name']);

    return possibleTags;
  }

  private evaluateXPath(xpath: string) {
    if (!this.document || !this.validator)
      throw new Error('vEditor: Document or Validator not set');

    return evaluateXPath(xpath, this.document);
  }

  getDocumentation(tagName: string = '') {
    if (tagName === '') return;

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
}

export const virtualEditor = new VirtualEditor();

export default VirtualEditor;
