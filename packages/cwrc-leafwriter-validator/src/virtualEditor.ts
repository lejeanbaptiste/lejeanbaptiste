import { safeParse, Validator } from '@cwrc/salve-dom-leafwriter';
import {
  readTreeFromJSON,
  type EventSet,
  type Grammar /* , GrammarWalker, NameResolver */,
} from '@cwrc/salve-leafwriter';
import { processSchema, verifyHash } from './conversion';
import { db } from './db';
import { logEnabledFor } from './log';
import { speculateAt } from './speculate';
import type {
  InitializeParameters,
  InitializeResponse,
  PossibleNodesAt,
  PossibleNodesAtOptions,
  Target,
} from './types';
import { evaluateXPath } from './utilities';
import { parseValidatorEvents, validate, type ValidationResponse } from './validate';

class VirtualEditor {
  private readonly validatorPrefix: string;

  document?: Document;
  schema?: Grammar;
  schemaId?: string;
  schemaUrl?: string;
  schemaRevision?: string | null;
  validator?: Validator;
  private initializeInFlight?: Promise<InitializeResponse>;
  // private walker?: GrammarWalker<NameResolver>;

  constructor() {
    this.validatorPrefix = 'lw';
  }

  async initialize(params: InitializeParameters): Promise<InitializeResponse> {
    if (this.sameSchemaIdentity(params)) {
      return { success: true };
    }

    if (this.initializeInFlight) {
      await this.initializeInFlight;
      if (this.sameSchemaIdentity(params)) {
        return { success: true };
      }
    }

    this.initializeInFlight = this.loadSchemaIntoWorker(params);
    try {
      return await this.initializeInFlight;
    } finally {
      this.initializeInFlight = undefined;
    }
  }

  private sameSchemaIdentity({
    id,
    url,
    schemaRevision = null,
  }: InitializeParameters): boolean {
    return (
      this.schemaId === id &&
      this.schemaUrl === url &&
      (this.schemaRevision ?? null) === (schemaRevision ?? null)
    );
  }

  private async loadSchemaIntoWorker({
    shouldCache = true,
    id,
    url,
    schemaText,
    schemaRevision = null,
  }: InitializeParameters): Promise<InitializeResponse> {
    let grammar;
    try {
      if (shouldCache && !schemaText) {
        const cachedSchema = await db.cachedSchemas.get(id);
        const validCache = cachedSchema?.hash ? await verifyHash(url, cachedSchema) : false;
        grammar =
          cachedSchema && validCache
            ? readTreeFromJSON(cachedSchema.gramarJson)
            : await processSchema({ id, url, shouldCache });
      } else {
        grammar = await processSchema({ id, url, schemaText, shouldCache: false });
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }

    if (!grammar) {
      return { success: false, error: new Error('Schema conversion returned no grammar') };
    }

    this.schemaId = id;
    this.schemaUrl = url;
    this.schemaRevision = schemaRevision ?? null;
    this.schema = grammar;

    return { success: true };
  }

  getDocumentation(tagName: string): string {
    // if (!this.schema) {
    //   throw new Error('schema is not set');
    // }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
    const definitions = Array.from(this.schema?.definitions.values());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const definition: any = definitions.find((def: any) => def.pat?.name?.name === tagName);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const documentation = definition
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        definition.pat.name.documentation
      : 'Element undefined or documentation unavailable';

    return documentation as string;
  }

  hasValidator() {
    return !!this.validator;
  }

  setDocument(documentString: string) {
    this.document = safeParse(documentString, window);
    return this.document;
  }

  setValidator() {
    if (!this.document || !this.schema) {
      throw new Error('vEditor: Document or schema not set');
    }

    const validator: Validator = new Validator(this.schema, this.document, {
      prefix: this.validatorPrefix,
      timeout: 0,
      maxTimespan: 0,
    });

    this.validator = validator;

    return this.validator;
  }

  startValidator() {
    this.validator?.start();
    return this.validator;
  }

  stopValidator() {
    this.validator?.stop();
    return this.validator;
  }

  validate(documentString: string, callback?: (workingStateData: ValidationResponse) => void) {
    this.document = this.setDocument(documentString);
    this.setValidator();
    if (!this.validator) return;

    validate(this, callback);
  }

  async getAttributesForTagAt(xpath: string, index = 1) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`getAttributesForTagAt: ${xpath}:${index}`);
      console.time('Timer');
    }

    const container = evaluateXPath(xpath, this.document);
    if (!container) return;

    const possibleEventsAt: EventSet = this.validator.possibleAt(container, index, true);
    const atttibutes = parseValidatorEvents(possibleEventsAt, {
      only: ['attributeName'],
    });

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Timer');
      console.groupEnd();
    }

    return atttibutes;
  }

  async getNodesForTagAt(xpath: string, index = 0) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`getNodesForTagAt: ${xpath}:${index}`);
      console.time('Get nodes for Tag');
    }

    const container = evaluateXPath(xpath, this.document);
    if (!container) return;

    const possibleEventsAt: EventSet = this.validator.possibleAt(container, index, false);
    const nodes = parseValidatorEvents(possibleEventsAt, {
      only: ['text', 'enterStartTag'],
    });

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Get nodes for Tag');
      console.groupEnd();
    }

    return nodes;
  }

  async getPossibleNodesAt(
    target: Target,
    options: PossibleNodesAtOptions = { speculativeValidate: true },
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

    const container = evaluateXPath(xpath, this.document);
    if (!container) return;

    const possibleEventsAt = this.validator.possibleAt(container, index);
    let possibleNodes = parseValidatorEvents(possibleEventsAt, {
      skip: ['leaveStartTag', 'endTag'],
    });

    if (speculativeValidate) {
      const speculativeNode = speculateAt(
        { document: this.document, validator: this.validator },
        { container, index, possibleNodes, selection },
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

  async getTagAt(tagName: string, parentXpath: string, index = 0) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`getTagAt: ${tagName} at ${parentXpath}:${index}`);
      console.time('Timer');
    }

    const container = evaluateXPath(parentXpath, this.document);
    if (!container) return;

    const possibleEventsAt = this.validator.possibleAt(container, index);
    const nodes = parseValidatorEvents(possibleEventsAt, {
      only: ['enterStartTag'],
    });

    const tag = nodes.find((attr) => attr.name === tagName);

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Timer');
      console.groupEnd();
    }

    return tag;
  }

  async getTagAttributeAt(attributeName: string, parentXpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) {
      console.groupCollapsed(`get tag ${attributeName} at ${parentXpath}`);
      console.time('Timer');
    }

    const container = evaluateXPath(parentXpath, this.document);
    if (!container) return;

    const possibleEventsAt: EventSet = this.validator.possibleAt(container, 1, true);
    const attributes = parseValidatorEvents(possibleEventsAt, {
      only: ['attributeName'],
    });

    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (logEnabledFor('DEBUG')) {
      console.timeEnd('Timer');
      console.groupEnd();
    }

    return attribute;
  }

  async getValidNodesAt(target: Target) {
    const possibleNodes = await this.getPossibleNodesAt(target, { speculativeValidate: true });
    if (!possibleNodes) return;
    possibleNodes.nodes = possibleNodes.nodes.filter((node) => !node.invalid);
    return possibleNodes;
  }

  async getValuesForTagAttributeAt(xpath: string) {
    if (!this.document || !this.validator) {
      throw new Error('vEditor: Document or Validator not set');
    }

    if (logEnabledFor('DEBUG')) console.time(`Get value for tag attribute at ${xpath}`);

    const container = evaluateXPath(xpath, this.document);
    if (!container) return;

    const possibleEventsAt = this.validator.possibleAt(container, 1, false);
    const attributeValues = parseValidatorEvents(possibleEventsAt, {
      only: ['attributeValue'],
    });

    if (logEnabledFor('DEBUG')) console.timeEnd('Get Value for Tag Attribute');

    return attributeValues;
  }

  reset() {
    this.stopValidator();

    this.document = undefined;
    this.schema = undefined;
    this.schemaId = undefined;
    this.schemaUrl = undefined;
    this.schemaRevision = undefined;
    this.validator = undefined;
    // this.walker = undefined;
  }
}

export const virtualEditor = new VirtualEditor();

export default VirtualEditor;
