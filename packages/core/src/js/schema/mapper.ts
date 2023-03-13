import $ from 'jquery';
import { SchemaMappingType } from '../../types';
import { log } from '../../utilities';
import Entity from '../entities/Entity';
import Writer from '../Writer';
import { cwrcEntry, empty, orlando, tei, teiLite } from './mappings';
import type { EntityTypes, EntityMappingProps } from './types';

// a list of reserved attribute names that are used by the editor
export const RESERVED_ATTRIBUTES = new Set([
  'id',
  'name',
  'class',
  'style',
  '_entity',
  '_type',
  '_tag',
  '_textallowed',
  '_note',
  '_candidate',
  '_attributes',
]);

export const getAttributeString = (attObj: { [x: string]: any }) => {
  let str = '';
  Object.entries(attObj).forEach(([key, value]) => {
    if (value && value !== '') str += ` ${key}="${value}"`;
  });
  return str;
};

/**
 * Gets the standard mapping for a tag and attributes.
 * Doesn't close the tag, so that further attributes can be added.
 * @param {Entity} entity The Entity from which to fetch attributes.
 * @param {Boolean} [closeTag] True to close the tag (i.e. add >). Default is true.
 * @returns {String}
 */
export const getTagAndDefaultAttributes = (entity: Entity, closeTag = true) => {
  const tag = entity.getTag();
  const attributes = Object.assign({}, entity.getAttributes());

  for (let key in attributes) {
    if (RESERVED_ATTRIBUTES.has(key)) delete attributes[key];
  }

  let xml = `<${tag}`;
  xml += getAttributeString(attributes);
  if (closeTag) xml += '>';

  return xml;
};

/**
 * Similar to the Mapper.getTagAndDefaultAttributes method but includes the end tag.
 * @param {Entity} entity
 * @returns {Array}
 */
export const getDefaultMapping = (entity: Entity): [string, string] => {
  return [getTagAndDefaultAttributes(entity), `</${entity.getTag()}>`];
};

export const xmlToString = (xmlData: Node) => {
  const xmlString = new XMLSerializer().serializeToString(xmlData);
  return xmlString;
};

class Mapper {
  readonly writer: Writer;

  readonly mappings = new Map([
    ['empty', empty],
    ['tei', tei],
    ['teiLite', teiLite],
    ['orlando', orlando],
    ['cwrcEntry', cwrcEntry],
  ]);

  currentMappingsId?: SchemaMappingType;

  constructor(writer: Writer) {
    this.writer = writer;
  }

  /**
   * Loads the mappings for the specified schema.
   * @param schemaMappingsId {String} The schema mapping ID.
   * @returns {Deferred} Deferred object that resolves when the mappings are loaded.
   */
  loadMappings(schemaMappingsId: SchemaMappingType) {
    this.clearMappings();
    this.currentMappingsId = schemaMappingsId;

    // process mappings
    const mappings = this.getMappings();
    if (!mappings) return;

    Object.entries(mappings.listeners).forEach(([name, listener]) => {
      this.writer.event(name).subscribe(listener);
    });
  }

  clearMappings() {
    const mappings = this.getMappings();
    if (!mappings) return;

    Object.entries(mappings.listeners).forEach(([name, listener]) => {
      this.writer.event(name).unsubscribe(listener);
    });
  }

  getMappings() {
    const mappings = this.currentMappingsId
      ? this.mappings.get(this.currentMappingsId)
      : this.mappings.get('empty');

    if (!mappings) throw new Error('Schema mappings not found');

    return mappings;
  }

  /**
   * Gets the XML mapping for the specified entity.
   * @param {Entity} entity
   * @returns {Array} An 2 item array of opening and closing tags. If the tag is empty then it will be in the second index.
   */
  getMapping(entity: Entity) {
    const type = entity.getType();
    const entry = this.getMappings().entities.get(type);
    return entry?.mappingFunction ? entry.mappingFunction(entity) : getDefaultMapping(entity);
  }

  /**
   * Removes the match entries from the mappingInfo object. Optionally removes the matched elements/attributes themselves.
   * @param {Element} entityElement
   * @param {Object} mappingInfo
   * @param {Boolean} isCWRC
   * @param {String|Array} textTag
   * @param {Boolean} removeMatch
   */
  private cleanupMappings({
    entityElement,
    mappingInfo,
    isCWRC,
    textTag,
    shouldRemoveMatch,
  }: {
    entityElement: Element;
    mappingInfo: { [x: string]: any };
    isCWRC: boolean;
    textTag?: string | any[];
    shouldRemoveMatch: boolean;
  }) {
    const isTextTag = (node: Element) => {
      const nodeName = isCWRC ? node.getAttribute('_tag') : node.nodeName;
      return Array.isArray(textTag) ? textTag.indexOf(nodeName) !== -1 : nodeName === textTag;
    };

    const removeMatch = (match: Node) => {
      switch (match.nodeType) {
        case Node.ATTRIBUTE_NODE:
          const matchAttr = match as Attr;
          if (matchAttr.ownerElement !== entityElement) {
            matchAttr.ownerElement?.parentElement?.removeChild(matchAttr.ownerElement);
          }
          break;

        case Node.ELEMENT_NODE:
          const matchElement = match as Element;
          if (matchElement !== entityElement) {
            if (isTextTag(matchElement)) {
              const firstChild = matchElement.firstChild;
              if (firstChild) $(firstChild).unwrap();
            } else {
              matchElement.parentElement?.removeChild(match);
            }
          }
          break;

        case Node.TEXT_NODE:
          const matchText = match as Text;
          if (matchText.parentElement !== entityElement) {
            // if that text's parent is not the entity then remove the text and the parent if it's not the textTag
            // otherwise just remove the text's parent
            const parentElement = matchText.parentElement;
            if (parentElement) {
              isTextTag(parentElement) ? $(match).unwrap() : $(parentElement).remove();
            }
          }
          break;

        default:
          log.warn(
            `mapper.getReverseMapping.cleanupMappings: cannot remove node with unknown type ${match}`
          );
          break;
      }
    };

    for (const key in mappingInfo) {
      if (key === 'attributes') continue;

      const level1 = mappingInfo[key];
      if (level1.match) {
        if (shouldRemoveMatch) removeMatch(level1.match);
        mappingInfo[key] = level1.value;
      } else {
        for (const key2 in level1) {
          const level2 = level1[key2];
          if (level2.match) {
            if (shouldRemoveMatch) removeMatch(level2.match);
            level1[key2] = level2.value;
          }
        }
      }
    }
  }

  private getValueFromXPath(contextEl: Element, xpath: string) {
    let value: any;
    let result: any = this.writer.utilities.evaluateXPath(contextEl, xpath);
    if (result === null) return;

    if (result.nodeType) {
      switch (result.nodeType) {
        case Node.ELEMENT_NODE:
          value = xmlToString(result);
          break;
        case Node.TEXT_NODE:
          value = result.textContent;
          break;
        case Node.ATTRIBUTE_NODE:
          value = result.value;
          break;
      }
    } else if (typeof result === 'string') {
      // TODO rework this because the result will be null
      // it's probably a local-name() function
      value = result;
      let innerXPath: RegExpExecArray | string | null = /^local-name\((.*)\)$/.exec(xpath); // try to get the inside of the name function

      if (innerXPath) {
        innerXPath = innerXPath[1];
        const innerResult = this.getValueFromXPath.call(this, contextEl, innerXPath);

        // hack: if innerResult return undefined, result is also undefined
        if (!innerResult) {
          log.warn(
            `mapper.getReverseMapping.getValueFromXPath: cannot get match for unrecognizable xpath ${xpath}`
          );
          result = undefined;
        } else {
          result = innerResult.match;
        }
      } else {
        log.warn(
          `mapper.getReverseMapping.getValueFromXPath: cannot get match for unrecognizable xpath ${xpath}`
        );
      }
    }

    return { value: value, match: result };
  }

  /**
   * Returns the mapping of an element to an entity config object.
   * @param {Element} element The element
   * @param {Boolean} [cleanUp] Whether to remove the elements that got matched by reverse mapping. Default is false.
   * @returns {Object} The entity config object.
   */
  getReverseMapping(element: Element, cleanUp: boolean = false) {
    const isCWRC = element.ownerDocument === this.writer.editor?.getDoc();
    const type = this.getEntityTypeForTag(element);

    // TODO should we return null and then have to check for that?
    if (!type) return {};

    const entry = this.getMappings().entities.get(type);
    if (!entry) return {};

    const mapping = entry.mapping;

    const obj: { [x: string]: any } = {
      attributes: {},
    };

    // attributes
    isCWRC
      ? (obj.attributes = this.writer.tagger.getAttributesForTag(element))
      : //@ts-ignore
        $.map(element.attributes, (att) => (obj.attributes[att.name] = att.value));

    // mapping values
    if (mapping) {
      Object.entries(mapping).forEach(([key, value]) => {
        if (typeof value === 'object') {
          obj[key] = {};
          for (const key2 in value) {
            const xpath = value[key2];
            const val = this.getValueFromXPath(element, xpath);
            if (val !== undefined) {
              obj[key][key2] = val;
            }
          }
        } else if (typeof value === 'string') {
          const xpath = value;
          const val = this.getValueFromXPath(element, xpath);
          if (val !== undefined) {
            obj[key] = val;
          }
        }
      });

      const textTag = this.getTextTag(type);

      this.cleanupMappings({
        entityElement: element,
        mappingInfo: obj,
        isCWRC,
        textTag,
        shouldRemoveMatch: cleanUp,
      });
    }

    // set type after mapping and cleanup is done
    obj.type = type;
    obj.isNote = this.isEntityTypeNote(type);

    return obj;
  }

  /**
   * Checks if the tag is for an entity.
   * @param {Element|String} element The tag to check.
   * @returns {String|null} The entity type, or null
   */
  getEntityTypeForTag(element: string | Element) {
    let tag: string;
    let isElement = false;

    if (typeof element === 'string') {
      tag = element;
    } else {
      isElement = true;
      const isCWRC = element.ownerDocument === this.writer.editor?.getDoc();
      if (!isCWRC) {
        tag = element.nodeName;
      } else {
        const _tagAttr = element.getAttribute('_tag');
        if (!_tagAttr) return null;
        tag = _tagAttr;
      }
    }

    // put xpath mappings at beginning
    const mappings = this.getMappings();
    let sortedMappings: Map<EntityTypes, EntityMappingProps> = new Map();

    mappings.entities.forEach((mapping, type) => {
      if (mapping.xpathSelector) {
        sortedMappings = new Map([[type, mapping], ...sortedMappings.entries()]);
      } else {
        sortedMappings.set(type, mapping);
      }
    });

    const sortedMappingsEntries = sortedMappings.entries();
    for (const [type, mapping] of sortedMappingsEntries) {
      // prioritize xpath
      if (mapping.xpathSelector && isElement && typeof element !== 'string') {
        const result = this.writer.utilities.evaluateXPath(element, mapping.xpathSelector);
        if (result) return type as EntityTypes;
      } else {
        const parentTag = mapping.parentTag;
        if ((Array.isArray(parentTag) && parentTag.indexOf(tag) !== -1) || parentTag === tag) {
          return type as EntityTypes;
        }
      }
    }

    return null;
  }

  /**
   * Gets the mapping for a property of a specific entity type
   * @param {String} type The entity type
   * @param {String} property The property name
   * @returns {String|undefined} The mapping
   */
  getMappingForProperty(type: EntityTypes, property: string) {
    // const entry = this.getMappings().entities[type];
    // if (entry.mapping && entry.mapping[property]) {
    //   return entry.mapping[property];
    // }
    // return;

    const entry = this.getMappings().entities.get(type);
    if (!entry || !entry.mapping) return;

    const properties = Object.entries(entry.mapping);

    const mappingproperty = properties.find(([key]) => key === property);
    if (mappingproperty) return mappingproperty[1] as string;

    return;
  }

  /**
   * Gets the attribute name mapping for a property of an entity type, if it exists
   * @param {String} type The entity type
   * @param {String} property The property name
   * @returns {String|undefined} The mapping
   */
  getAttributeForProperty(type: EntityTypes, property: string) {
    const mappingString = this.getMappingForProperty(type, property);
    if (mappingString && /^@\w+$/.test(mappingString)) {
      // if it looks like an attribute, remove the @ and return the attribute name
      return mappingString.slice(1);
    }
    return;
  }

  /**
   * Get all the properties for the entity type that have mappings to attributes
   * @param {String} type The entity type
   * @returns {Array}
   */
  getMappedProperties(type: EntityTypes) {
    const entry = this.getMappings().entities.get(type);
    if (!entry) return;

    const props: string[] = [];

    if (entry.mapping) {
      for (let key in entry.mapping) {
        if (key === 'customValues') continue;
        props.push(key);
      }
    }

    return props;
  }

  /**
   * If the entity has properties that map to attributes, update the property values with those from the attributes
   * @param {Entity} entity
   */
  updatePropertiesFromAttributes(entity: Entity) {
    const type = entity.getType();
    const entry = this.getMappings().entities.get(type);
    if (!entry?.mapping) return;

    Object.entries(entry.mapping).forEach(([key, mapValue]) => {
      if (key === 'customValues') return;

      if (typeof mapValue === 'string' && /^@\w+$/.test(mapValue)) {
        const attributeName = mapValue.slice(1);
        const attributeValue = entity.getAttribute(attributeName);

        if (attributeValue) entity.setProperty(key, attributeValue);
      }
    });

    // for (let key in entry.mapping) {
    //   if (key === 'customValues') continue;

    //   const mapValue = entry.mapping[key];
    //   if (typeof mapValue === 'string' && /^@\w+$/.test(mapValue)) {
    //     const attributeName = mapValue.slice(1);
    //     const attributeValue = entity.getAttribute(attributeName);

    //     if (attributeValue) entity.setProperty(key, attributeValue);
    //   }
    // }
  }

  /**
   * Checks if the specified entity type is "a note or note-like".
   * @param {String} type The entity type
   * @returns {Boolean}
   */
  isEntityTypeNote(type?: EntityTypes) {
    if (!type) return false;

    const isNote = this.getMappings().entities.get(type)?.isNote;
    return isNote === undefined ? false : isNote;
  }

  /**
   * Checks if the specified entity type is a named entity, i.e. specifies a URI.
   * @param {String} type The entity type
   * @returns {Boolean}
   */
  isNamedEntity(type?: EntityTypes) {
    if (!type) return false;

    const entry = this.getMappings().entities.get(type);
    return entry?.mapping?.uri ? true : false;
  }

  /**
   * Checks if the specified entity type requires a text selection in order to be tagged
   * @param {String} type The entity type
   * @returns {Boolean}
   */
  doesEntityRequireSelection(type: EntityTypes) {
    if (!type) return false;

    const requiresSelection = this.getMappings().entities.get(type)?.requiresSelection;
    return requiresSelection === undefined ? true : requiresSelection;
  }

  /**
   * Converts a tag to an entity
   * @param {Element} tag The tag
   * @param {Boolean} [showEntityDialog] Should the entity dialog be shown after conversion? Default is false
   * @returns {Entity|null} The new entity
   */
  convertTagToEntity(tag: Element, showEntityDialog: boolean = false) {
    const entityType = this.getEntityTypeForTag(tag);
    const _tagAttr = tag.getAttribute('_tag');

    if (!entityType) {
      log.warn(`mapper.convertTagToEntity: tag ${_tagAttr} cannot be converted to an entity!`);
      return;
    }

    const id = tag.getAttribute('id');
    const isNote = this.isEntityTypeNote(entityType);
    const isNamedEntity = this.isNamedEntity(entityType);
    const config: { [x: string]: any } = {
      id,
      tag: _tagAttr,
      type: entityType,
      isNote,
      isNamedEntity,
      range: { startXPath: this.writer.utilities.getElementXPath(tag) },
    };

    const mappingInfo = this.getReverseMapping(tag, true);
    $.extend(config, mappingInfo);

    if (isNote) {
      const $tag = $(tag);
      config.content = $tag.text();
      config.noteContent = $tag.html();
    }

    const entityAttributes: { [x: string]: any } = {
      _entity: true,
      _type: entityType,
      class: `entity ${entityType} start end`,
      name: id,
    };

    if (isNote) entityAttributes['_note'] = true;

    for (const name in entityAttributes) {
      tag.setAttribute(name, entityAttributes[name]);
    }

    if (isNote) this.writer.tagger.addNoteWrapper(tag, entityType);

    const entity = this.writer.entitiesManager.addEntity(config as Entity);

    if (showEntityDialog) {
      if (!isNamedEntity || (isNamedEntity && !entity.getURI())) {
        this.writer.dialogManager.show(entityType, { type: entityType, entry: entity });
      }
    }

    return entity;
  }

  /**
   * Look for candidate entities inside the passed element
   * @param {Array} [typesToFind] An array of entity types to find, defaults to all types
   * @returns {Object} A map of the entities, organized by type
   */
  findEntities(
    typesToFind: Set<string> = new Set([
      'person',
      'place',
      'org',
      'organization',
      'title',
      'rs',
      'citation',
      'note',
      'date',
      'correction',
      'keyword',
      'link',
    ])
  ) {
    const candidateEntities: { [x: string]: HTMLElement[] } = {};
    const headerTag = this.getHeaderTag();

    // TODO tei mapping for correction will match on both choice and corr tags, creating 2 entities when it should be one
    //? Maybe fix... double check

    const entityMappings = this.getMappings().entities;

    for (const [type, entity] of entityMappings.entries()) {
      if (!typesToFind.has(type)) continue;

      let entityTagNames: string[] = [];

      let parentTag = entity.parentTag;
      if (Array.isArray(parentTag)) entityTagNames = [...entityTagNames, ...parentTag];
      if (Array.isArray(parentTag)) {
        parentTag = parentTag[0];
        if (parentTag !== '') entityTagNames.push(parentTag);
      }
      if (parentTag !== '') entityTagNames.push(parentTag);

      entityTagNames = entityTagNames.map((name) => `[_tag="${name}"]`);

      const matches = $(entityTagNames.join(','), this.writer.editor?.getBody()).filter(
        (index, element) => {
          if (element.getAttribute('_entity') === 'true') return false;
          
          if ($(element).parents(`[_tag="${headerTag}"]`).length !== 0) return false;
          
          // double check entity type using element instead of string, which forces xpath evaluation, which we want for tei note entities
          const entityType = this.getEntityTypeForTag(element);
          if (!entityType) return false;
         
          const entry = this.getMappings().entities.get(entityType);
          
          // if the mapping has a uri, check to make sure it exists
          if (entry?.mapping?.uri) {
            const result = this.writer.utilities.evaluateXPath(element, entry.mapping.uri);
            if (result) return true;
          } else {
            return true;
          }

          return false;
        }
      );

      candidateEntities[type] = $.makeArray(matches);
    }

    return candidateEntities;
  }

  /**
   * Returns the parent tag for entity when converted to a particular schema.
   * @param {String} type The entity type.
   * @returns {String}
   */
  getParentTag(type: EntityTypes) {
    const tag = this.getMappings().entities.get(type)?.parentTag;
    if (!tag) return '';
    if (Array.isArray(tag)) return tag[0];
    return tag;
  }

  /**
   * Returns the text tag (tag containing user-highlighted text) for entity when converted to a particular schema.
   * @param {String} type The entity type.
   * @returns {String}
   */
  getTextTag(type: EntityTypes) {
    return this.getMappings().entities.get(type)?.textTag;
  }

  /**
   * Returns the required attributes (atttribute names & values that are always added) for this entity type.
   * @param {String} type The entity type.
   * @returns {Object}
   */
  getRequiredAttributes(type: EntityTypes) {
    const requiredAttributes = this.getMappings().entities.get(type)?.requiredAttributes;
    return requiredAttributes === undefined ? {} : requiredAttributes;
  }

  /**
   * Returns the entities mapping for the current schemaMapping
   * @param {String} type The entity type.
   * @returns {Object}
   */
  getEntitiesMapping() {
    return this.getMappings().entities;
  }

  /**
   * Returns the root tags for the current schema.
   * @returns {Array}
   */
  getRootTags() {
    return this.getMappings().root;
  }

  /**
   * Returns the name of the header tag for the current schema.
   * @returns {String}
   */
  getHeaderTag() {
    return this.getMappings().header;
  }

    /**
   * Returns the names of the headings tags for the current schema.
   * @returns {String}
   */
    getHeadingTags() {
      return this.getMappings().headings;
    }

  /**
   * Returns the namespace for the current schema.
   * @returns {String}
   */
  getNamespace() {
    return this.getMappings().namespace;
  }

  /**
   * Returns the name for the ID attribute for the current schema.
   * @returns {String}
   */
  getIdAttributeName() {
    return this.getMappings().id;
  }

  /**
   * Returns the name for the responsibility attribute for the current schema.
   * @returns {String}
   */
  getResponsibilityAttributeName() {
    return this.getMappings().responsibility;
  }

  /**
   * Returns the xpath selector for the RDF parent for the current schema.
   * @returns {String}
   */
  getRdfParentSelector() {
    return this.getMappings().rdfParentSelector;
  }

  /**
   * Returns the block level elements for the current schema.
   * @returns {Array}
   */
  getBlockLevelElements() {
    return this.getMappings().blockElements;
  }

  /**
   * Returns the attribute names that define whether the tag is an URL.
   * @returns {Array}
   */
  getUrlAttributes() {
    return this.getMappings().urlAttributes || [];
  }
}

export default Mapper;
