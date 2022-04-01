import { safeParse, Validator } from '@cwrc/salve-dom-leafwriter';
import { Grammar /* , GrammarWalker, NameResolver */ } from '@cwrc/salve-leafwriter';
import { v4 as uuidv4 } from 'uuid';

class VirtualEditor {
  private readonly validatorPrefix: string;

  private _id: string;
  private _schemaId?: string;
  private _schema?: Grammar;
  // private walker?: GrammarWalker<NameResolver>;
  private _docXML?: Document;
  private _validator?: Validator;

  constructor() {
    this._id = uuidv4();
    this.validatorPrefix = 'cwrc';
  }

  reset() {
    this.stopValidator();
    this._id = uuidv4();
    this._schemaId = undefined;
    this._schema = undefined;
    // this.walker = undefined;
    this._docXML = undefined;
    this._validator = undefined;

    return this;
  }

  get id() {
    return this._id;
  }

  get schemaId() {
    return this._schemaId;
  }

  get schema() {
    return this._schema;
  }

  async setSchema({ id, grammar }: { id: string; grammar: Grammar }): Promise<Grammar> {
    this._schemaId = id;
    this._schema = grammar;
    // this.walker = grammar.newWalker();

    return this._schema;
  }

  get document() {
    return this._docXML;
  }

  setDocument(documentString: string) {
    this._docXML = safeParse(documentString, window);
    return this._docXML;
  }

  get validator() {
    return this._validator;
  }

  setValidator() {
    if (!this._docXML) throw new Error('Document is not set');
    if (!this._schema) throw new Error('Schema is not set');

    const validator: Validator = new Validator(this._schema, this._docXML, {
      prefix: this.validatorPrefix,
      timeout: 0,
      maxTimespan: 0,
    });

    this._validator = validator;

    return this._validator;
  }

  hasValidator() {
    return this._validator ? true : false;
  }

  startValidator() {
    if (!this._validator) throw new Error('Validator is not set');

    this._validator.start();

    return this._validator;
  }

  stopValidator() {
    if (!this._validator) throw new Error('Validator is not set');
    this._validator.stop();

    return this._validator;
  }
}

export const virtualEditor = new VirtualEditor();

export default VirtualEditor;
