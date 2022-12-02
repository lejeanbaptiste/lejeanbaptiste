// a wrapper for the pub/sub pattern described here: http://api.jquery.com/jQuery.Callbacks/
import $ from 'jquery';
import { log } from './../utilities';

interface Events {
  [x: string]: EventProps;
}

interface EventProps {
  event: string;
  publish: (...args: any) => any;
  subscribe: (
    callback: JQuery.TypeOrArray<Function>,
    ...callbacks: JQuery.TypeOrArray<Function>[]
  ) => JQuery.Callbacks<Function>;
  unsubscribe: (...callbacks: Function[]) => JQuery.Callbacks<Function>;
}

/**
 * @class EventManager
 * @param {Writer} writer
 */
class EventManager {
  doDebug = false;
  events: Events = {};

  constructor() {
    this.events = {};

    /**
     * Register an event with the Writer
     * @memberof Writer
     * @method event
     * @instance
     * @param {String} id The unique event name
     */

    /**
     * CWRCWriter events
     */

    /**
     * The writer has been initialized
     * @event Writer#writerInitialized
     * @param {Object} writer The CWRCWriter
     */
    this.event('writerInitialized');

    /**
     * The editor has been initialized
     * @event Writer#tinymceInitialized
     * @param {Object} writer The CWRCWriter
     */
    this.event('tinymceInitialized');

    /**
     * The StructureTree has been initialized
     * @event Writer#structureTreeInitialized
     * @param {Object} structureTree The StructureTree
     */
    this.event('structureTreeInitialized');
    /**
     * The EntitiesList has been initialized
     * @event Writer#entitiesListInitialized
     * @param {Object} entitiesList The EntitiesList
     */
    this.event('entitiesListInitialized');

    /**
     * The current node was changed
     * @event Writer#nodeChanged
     * @param {Element} node The current node
     */
    this.event('nodeChanged');
    /**
     * Content was changed in the editor.
     * Should only be fired if tags change, not simply text.
     * @event Writer#contentChanged
     */
    this.event('contentChanged');

    /**
     * A document is being fetched from a source
     * @event Writer#loadingDocument
     */
    this.event('loadingDocument');

    /**
     * A document is being processed into the editor format
     * @event Writer#processingDocument
     * @param {Number} percentComplete
     */
    this.event('processingDocument');

    /**
     * A document was loaded into the editor
     * @event Writer#documentLoaded
     * @params {Boolean} success Was the document successfully loaded?
     * @param {Element} body The editor body element
     */
    this.event('documentLoaded');

    /**
     * A document was saved
     * @event Writer#documentSaved
     */
    this.event('documentSaved');

    /**
     * A document is being saved to server
     * @event Writer#documentSaved
     */
    this.event('savingDocument');

    /**
     * A schema is being fetched from a source
     * @event Writer#loadingSchema
     */
    this.event('loadingSchema');
    /**
     * A schema was loaded into the editor
     * @event Writer#schemaLoaded
     */
    this.event('schemaLoaded');
    /**
     * The current schema was changed
     * @event Writer#schemaChanged
     * @param {String} id The id of the new schema
     */
    this.event('schemaChanged');
    /**
     * A schema was added to the list of available schemas
     * @event Writer#schemaAdded
     * @param {String} id The id of the new schema
     */
    this.event('schemaAdded');

    /**
     * The worker validator was loaded
     * @event Writer#workerValidatorLoaded
     */
    this.event('workerValidatorLoaded');

    /**
     * A document was sent to the validation service
     * @event Writer#validationInitiated
     */
    this.event('validationInitiated');

    /**
     * A document was validated
     * @event Writer#documentValidated
     * @param {Boolean} isValid True if the doc is valid
     * @param {Document} results Validation results
     * @param {String} docString The string sent to the validator
     */
    this.event('documentValidated');

    /**
     * A document is validating
     * @event Writer#documentValidating
     * @param {Number} partDone percentage of the document validated (0-1)
     */
    this.event('documentValidating');

    /**
     * A segment of the document was copied
     * @event Writer#contentCopied
     */
    this.event('contentCopied');
    /**
     * Content was pasted into the document
     * @event Writer#contentPasted
     */
    this.event('contentPasted');

    /**
     * The user triggered a keydown event in the editor
     * @event Writer#writerKeydown
     * @param {Object} event Event object
     */
    this.event('writerKeydown');
    /**
     * The user triggered a keyup event in the editor
     * @event Writer#writerKeyup
     * @param {Object} event Event object
     */
    this.event('writerKeyup');

    /**
     * An entity was added to the document
     * @event Writer#entityAdded
     * @param {String} id The entity ID
     */
    this.event('entityAdded');
    /**
     * An entity was edited in the document
     * @event Writer#entityEdited
     * @param {String} id The entity ID
     */
    this.event('entityEdited');
    /**
     * An entity was removed from the document
     * @event Writer#entityRemoved
     * @param {String} id The entity ID
     */
    this.event('entityRemoved');
    /**
     * An entity was focused on in the document
     * @event Writer#entityFocused
     * @param {String} id The entity ID
     */
    this.event('entityFocused');
    /**
     * An entity was unfocused on in the document
     * @event Writer#entityUnfocused
     * @param {String} id The entity ID
     */
    this.event('entityUnfocused');
    /**
     * An entity was copied to the internal clipboard
     * @event Writer#entityCopied
     * @param {String} id The entity ID
     */
    this.event('entityCopied');
    /**
     * An entity was pasted to the document
     * @event Writer#entityPasted
     * @param {String} id The entity ID
     */
    this.event('entityPasted');

    /**
     * A structure tag was added
     * @event Writer#tagAdded
     * @param {Element} tag The tag
     */
    this.event('tagAdded');
    /**
     * A structure tag was edited
     * @event Writer#tagEdited
     * @param {String} id The tag ID
     */
    this.event('tagEdited');
    /**
     * A structure tag was removed
     * @event Writer#tagRemoved
     * @param {Element} tag The tag
     */
    this.event('tagRemoved');
    /**
     * A structure tag's contents were removed
     * @event Writer#tagContentsRemoved
     * @param {String} id The tag ID
     */
    this.event('tagContentsRemoved');
    /**
     * A structure tag was selected
     * @event Writer#tagSelected
     * @param {String} id The tag ID
     * @param {Boolean} contentsSelected True if only tag contents were selected
     */
    this.event('tagSelected');

    /**
     * The selection in the editor changed
     * @event Writer@selectionChanged
     */
    this.event('selectionChanged');

    /**
     * Numerous changes to the document are being made in succession
     * @event Writer@massUpdateStarted
     */
    this.event('massUpdateStarted');

    /**
     * The numerous changes to the document are complete
     * @event Writer@massUpdateCompleted
     */
    this.event('massUpdateCompleted');
  }

  event(id: string) {
    const _this = this;
    let event: EventProps = this.events[id];

    if (!event) {
      const callbacks = $.Callbacks();
      event = {
        publish: function () {
          if (_this.doDebug) {
            log.debug(`Leaf-Writer "${this.event}": ${arguments}`);
          }
          //@ts-ignore
          callbacks.fire.apply(this, arguments);
        },
        subscribe: callbacks.add,
        unsubscribe: callbacks.remove,
        event: id,
      };
    }

    this.events[id] = event;

    return event;
  }

  /**
   * Get the list of events
   * @returns {Object}
   */
  getEvents() {
    return this.events;
  }

  destroy() {
    // TODO empty callbacks
  }

  /**
   * Whether to output events to the console.
   * @param {Boolean} doIt
   */
  debug(doIt: boolean) {
    this.doDebug = doIt;
  }
}

export default EventManager;
