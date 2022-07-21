//@ts-nocheck
import $ from 'jquery';
import type { Bookmark } from 'tinymce';
import { log } from './../utilities';
import Entity from './entities/Entity';
import { RESERVED_ATTRIBUTES } from './schema/mapper';
import type { EntityTypes } from './schema/types';
import Writer from './Writer';

export type Action = 'add' | 'before' | 'after' | 'around' | 'inside' | 'change';
// type SelectionResults = 'no_selection' | 'no_common_parent' | 'overlap' | 'valid';

/**
 * @class Tagger
 * @param {Writer} writer
 */
class Tagger {
  readonly writer: Writer;

  // tag insertion types (actions)
  readonly ADD = 'add';
  readonly BEFORE = 'before';
  readonly AFTER = 'after';
  readonly AROUND = 'around';
  readonly INSIDE = 'inside';

  // isSelectionValid results
  readonly NO_SELECTION = 'no_selection';
  readonly NO_COMMON_PARENT = 'no_common_parent';
  readonly OVERLAP = 'overlap';
  readonly VALID = 'valid';

  constructor(writer: Writer) {
    this.writer = writer;
  }

  /**
   * Get a tag by id, or get the currently selected tag.
   * @param {String} [id] The id (optional)
   * @returns {jQuery<any>}
   */
  getCurrentTag(id?: string) {
    if (!id) return $(this.writer.editor?.selection.getNode());

    let tag = $(`#${id}`, this.writer.editor?.getBody());
    if (tag.length === 0) {
      // look for overlapping entity
      tag = $(`[name="${id}"]`, this.writer.editor?.getBody());
    }
    return tag;
  }

  /**
   * Gets the attributes stored in the _attributes holder.
   * @param {Element} tag
   * @returns {Object}
   */
  getAttributesForTag(tag: Element) {
    const attributes = tag.getAttribute('_attributes');
    if (!attributes) return {};

    const jsonAttrsString = attributes.replace(/&quot;/g, '"');
    const json = JSON.parse(jsonAttrsString);
    return json;
  }

  /**
   * Adds (non-reserved) attributes to the tag. All attributes get added to the _attributes holder.
   * Overwrites previously set attributes.
   * Assumes the attributes object does not contain LEAF-Writer related attributes, e.g. _tag.
   * @param {Element} tag The tag
   * @param {Object} attributes A name/value map of attributes
   */
  setAttributesForTag(tag: Element, attributes: { [x: string]: string }) {
    // remove previous attributes
    const currAttributes = tag.attributes;
    for (let i = currAttributes.length - 1; i >= 0; i--) {
      const attr = currAttributes[i];
      // if (Mapper.reservedAttributes[attr.name] !== true) {
      // tag.removeAttribute(attr.name);
      // }
      if (!RESERVED_ATTRIBUTES.has(attr.name)) {
        tag.removeAttribute(attr.name);
      }
    }

    // set non-reserved attributes directly on the tag
    for (const attName in attributes) {
      // if (Mapper.reservedAttributes[attName] !== true) {
      //   continue;
      // }
      if (!RESERVED_ATTRIBUTES.has(attName)) continue;

      tag.setAttribute(attName, attributes[attName]);
    }

    // set all attributes in the _attributes holder
    const jsonAttrsString = JSON.stringify(attributes).replace(/"/g, '&quot;');
    tag.setAttribute('_attributes', jsonAttrsString);
  }

  /**
   * Similar to setAttributesForTag but doesn't overwrite previously set attributes.
   * @param {Element} tag The tag
   * @param {Object} attributes A name/value map of attributes
   */
  addAttributesToTag(tag: Element, attributes: { [x: string]: string }) {
    const currAttrs = this.getAttributesForTag(tag);

    for (const attName in attributes) {
      // if (Mapper.reservedAttributes[attName] !== true) {
      //   // if (reservedAttributes.get(attName) === true) {
      //   continue;
      // }
      if (!RESERVED_ATTRIBUTES.has(attName)) continue;

      const attValue = attributes[attName];
      tag.setAttribute(attName, attValue);
      currAttrs[attName] = attValue;
    }

    const jsonAttrsString = JSON.stringify(currAttrs).replace(/"/g, '&quot;');
    tag.setAttribute('_attributes', jsonAttrsString);
  }

  /**
   * Remove an attribute from the tag
   * @param {Element} tag The tag
   * @param {String} attribute The attribute name
   */
  removeAttributeFromTag(tag: Element, attributeName: string) {
    tag.removeAttribute(attributeName);
    const currAttrs = this.getAttributesForTag(tag);

    delete currAttrs[attributeName];

    const jsonAttrsString = JSON.stringify(currAttrs).replace(/"/g, '&quot;');
    tag.setAttribute('_attributes', jsonAttrsString);
  }

  /**
   * Displays the appropriate dialog for adding a tag.
   * @param {String} tagName The tag name.
   * @param {String} tagFullname The tag name.
   * @param {String} action The tag insertion type to perform.
   * @param {String} [parentTagId] The id of the parent tag on which to perform the action. Will use editor selection if not provided.
   */
  addTagDialog({
    action,
    parentTagId,
    tagFullname,
    tagName,
  }: {
    action: Action;
    parentTagId?: string | string[];
    tagFullname?: string;
    tagName: string;
  }) {
    if (!this.writer.editor) return;
    if (tagName === this.writer.schemaManager.getHeader()) {
      //? prevent showing haeader dialog
      //! deprecated
      // this.writer.dialogManager.show('header');
      return;
    }

    const tagId = this.writer.editor?.currentBookmark?.tagId; // set by structureTree
    if (!tagId) {
      this.writer.editor.selection.moveToBookmark(this.writer.editor.currentBookmark);

      const cleanRange = action === this.ADD;
      const valid = this.isSelectionValid({ isStructTag: true, cleanRange });

      if (valid !== this.VALID) {
        this.writer.dialogManager.show('message', {
          title: 'Error',
          msg: `
            Please ensure that the beginning and end of your selection have a common parent.<br/>
            For example, your selection cannot begin in one paragraph and end in another, or begin in bolded text and end outside of that text.
          `,
          type: 'error',
        });
        return;
      }

      // reset bookmark after possible modification by isSelectionValid
      this.writer.editor.currentBookmark = this.writer.editor?.selection.getBookmark(1);
    }

    let tagPath: string | undefined;
    if (Array.isArray(parentTagId)) {
      // TODO multiple parent tags??
    } else if (action === this.ADD || action === this.INSIDE) {
      // TODO determine tagPath for other actions
      let parentTag;

      if (!parentTagId) {
        const selectionParent = this.writer.editor.currentBookmark.rng.commonAncestorContainer;
        parentTag =
          selectionParent.nodeType === Node.TEXT_NODE
            ? $(selectionParent).parent()
            : $(selectionParent);
      } else {
        parentTag = $(`#${parentTagId}`, this.writer.editor.getBody());
      }

      tagPath = this.writer.utilities.getElementXPath(parentTag[0]) ?? undefined;
      tagPath += `/${tagName}`;
    }

    const attributesEditor = this.writer.dialogManager.getDialog('attributesEditor');
    if (attributesEditor) {
      attributesEditor.show({
        attributes: {},
        callback: (attributes: any) => {
          if (attributes) {
            const bookmark = this.writer.editor?.currentBookmark;
            this.addStructureTag({ action, attributes, bookmark, tagName });
          }
          delete this.writer.editor.currentBookmark.tagId;
        },
        tagFullname,
        tagName,
        tagPath,
      });
    }
  }

  /**
   * A general edit function for entities and structure tags.
   * @param {String} id The tag id
   */
  editTagDialog(id: string | string[]) {
    if (!this.writer.editor) return;
    //? what to do if id is multiple
    if (Array.isArray(id)) id = id[0];

    const tag = this.getCurrentTag(id) as JQuery<HTMLElement>;

    if (tag.attr('_entity')) {
      this.writer.editor.currentBookmark = this.writer.editor.selection.getBookmark(1);

      const attrID = tag.attr('id');

      if (attrID) {
        const entry = this.writer.entitiesManager.getEntity(attrID);
        if (entry) this.writer.dialogManager.show(entry.getType(), { entry });
      } else {
        log.warn('tagger.editTag: no entry for entity', tag);
      }
    } else {
      const tagName = tag.attr('_tag');
      if (tagName === this.writer.schemaManager.getHeader()) {
        // this.writer.dialogManager.show('header');
        return;
      }

      const tagPath = this.writer.utilities.getElementXPath(tag[0]);
      const attributes = this.getAttributesForTag(tag[0]);

      const attributesEditor = this.writer.dialogManager.getDialog('attributesEditor');
      if (attributesEditor) {
        attributesEditor.show({
          attributes,
          callback: (newAttributes: any) => {
            if (newAttributes) this.editStructureTag(tag, newAttributes);
          },
          tagName,
          tagPath,
        });
      }
    }
  }

  /**
   * A general change/replace function
   * @param {String} tagName The new tag name
   * @param {String} [id] The tag id. If undefined, will get the currently selected tag.
   */
  changeTagDialog(tagName: string, id?: string | string[]) {
    //? what to do if id is multiple
    if (Array.isArray(id)) id = id[0];

    const tag = this.getCurrentTag(id) as JQuery<HTMLElement>;

    if (tag.attr('_entity')) {
      this.writer.dialogManager.confirm({
        title: 'Remove Entity?',
        msg: 'Changing this tag will remove the associated annotation. Do you want to proceed?',
        showConfirmKey: 'confirm-change-tag-remove-entity',
        type: 'info',
        callback: (confirmed: boolean) => {
          if (!confirmed) return;

          const newTag = this.removeEntity(id);
          if (!newTag) return log.warn('new tag not found');
          if (!newTag.parentElement) return log.warn('new tag parentElement not found');

          let tagPath = this.writer.utilities.getElementXPath(newTag.parentElement);
          tagPath += `/${tagName}`;
          const attributes = this.getAttributesForTag(newTag);

          const attributesEditor = this.writer.dialogManager.getDialog('attributesEditor');
          if (attributesEditor) {
            attributesEditor.show({
              attributes,
              callback: (newAttributes: any) => {
                if (newAttributes) this.editStructureTag($(newTag), newAttributes, tagName);
              },
              tagName,
              tagPath,
            });
          }
        },
      });

      return;
    }

    let tagPath = this.writer.utilities.getElementXPath(tag.parent()[0]);
    tagPath += `/${tagName}`;
    const attributes = this.getAttributesForTag(tag[0]);

    const attributesEditor = this.writer.dialogManager.getDialog('attributesEditor');
    if (attributesEditor) {
      attributesEditor.show({
        attributes,
        callback: (newAttributes: any) => {
          if (newAttributes) this.editStructureTag(tag, newAttributes, tagName);
        },
        tagName,
        tagPath,
      });
    }
  }

  /**
   * Displays the appropriate dialog for adding an entity
   * @param {String} type The entity type
   * @param {String} [tag] The element name
   */
  addEntityDialog(type: EntityTypes, tag?: string) {
    if (!this.writer.editor) return;

    const requiresSelection = this.writer.schemaManager.mapper.doesEntityRequireSelection(type);
    const result =
      !requiresSelection && this.writer.editor.selection.isCollapsed()
        ? this.VALID
        : this.isSelectionValid({ isStructTag: false, cleanRange: true });

    if (result === this.NO_SELECTION) {
      this.writer.dialogManager.show('message', {
        title: 'Error',
        msg: 'Please select some text before adding an entity.',
        type: 'error',
      });
      return;
    }

    this.writer.editor.currentBookmark = this.writer.editor.selection.getBookmark(1);

    if (result === this.VALID) {
      const childName = tag ? tag : this.writer.schemaManager.mapper.getParentTag(type);

      let parentTag = this.writer.editor.currentBookmark.rng.commonAncestorContainer;
      while (parentTag.nodeType !== Node.ELEMENT_NODE) {
        parentTag = parentTag.parentNode;
      }

      const parentName = parentTag.getAttribute('_tag');
      const isValid = this.writer.schemaManager.isTagValidChildOfParent(childName, parentName);

      if (!isValid) {
        this.writer.dialogManager.show('message', {
          title: 'Invalid XML',
          msg: `
            You cannot add a ${type} entity in this location because its element <b>${childName}</b> is not a valid child of <b>${parentName}</b>.
          `,
          type: 'error',
        });
      }

      this.writer.dialogManager.show(type);
      return;
    }

    if (result === this.OVERLAP) {
      if (!this.writer.allowOverlap === true) {
        this.writer.dialogManager.confirm({
          title: 'Warning',
          msg: `
            <p>You are attempting to create overlapping entities or to create an entity across sibling XML tags, which is not allowed in this editor mode.</p>
            <p>If you wish to continue, the editor mode will be switched to <b>XML and RDF (Overlapping Entities)</b> and only RDF will be created for the entity you intend to add.</p>
            <p>Do you wish to continue?</p>
          `,
          showConfirmKey: 'confirm-overlapping-entities',
          type: 'info',
          height: 350,
          callback: (confirmed: boolean) => {
            if (!confirmed) return;

            this.writer.allowOverlap = true;
            this.writer.mode = this.writer.XMLRDF;
            this.writer.dialogManager.show(type);
          },
        });

        return;
      }

      this.writer.dialogManager.show(type);
      return;
    }
  }

  /**
   * A general removal function for entities and structure tags
   * @param {String} [id] The id of the tag to remove
   */
  removeTag(id: string) {
    const $tag = this.getCurrentTag(id) as JQuery<HTMLElement>;
    $tag.attr('_entity') ? this.removeEntity(id) : this.removeStructureTag(id);
  }

  /**
   * @param {String} id The id of the struct tag or entity to copy
   */
  copyTag(id: string | string[]) {
    if (!this.writer.editor) return;

    //? what to do if id is multiple
    if (Array.isArray(id)) id = id[0];
    const tag = this.getCurrentTag(id) as JQuery<HTMLElement>;

    if (tag.attr('_entity')) {
      const clone = tag.attr('_note') ? tag.parent('.noteWrapper').clone(true) : tag.clone();
      this.writer.editor.copiedEntity = clone[0];
    } else {
      const clone = tag.clone();
      this.writer.editor.copiedElement.element = clone[0];
      this.writer.editor.copiedElement.selectionType = 0; // tag & contents copied
    }
  }

  /**
   * Pastes a previously copied tag
   * @fires Writer#contentChanged
   */
  pasteTag() {
    if (!this.writer.editor) return;
    if (this.writer.editor.copiedElement?.element) {
      this.doPaste(this.writer.editor.copiedElement.element);
      this.writer.editor.copiedElement = { selectionType: null };
    }
  }

  /**
   * Split a tag in two based on the current text selection.
   */
  splitTag() {
    const range: Range = this.writer.editor?.selection.getRng(true);

    if (range.startContainer.nodeType !== Node.TEXT_NODE) {
      log.warn('tagger.splitTag: no text selection!');
      return;
    }

    const textNode = range.startContainer;
    const parent = textNode.parentNode as HTMLElement;

    if (!parent || parent.nodeType !== Node.ELEMENT_NODE) {
      log.warn('tagger.splitTag: tag parent not found');
      return;
    }

    if (parent.getAttribute('_entity')) {
      log.warn('tagger.splitTag: cannot split an entity!');
      return;
    }

    let wrapString = `<${parent.nodeName.toLowerCase()}`;
    for (let i = 0; i < parent.attributes.length; i++) {
      const attr = parent.attributes[i];
      if (attr.name !== 'id') {
        wrapString += ` ${attr.name}="${attr.value}"`;
      }
    }
    wrapString += `></${parent.nodeName.toLowerCase()}>`;

    parent.normalize();
    textNode.splitText(range.startOffset);

    let lastChild;
    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        lastChild = $(child).wrap(wrapString);
      }
    }

    $(parent)
      .contents()
      .each((index, element) => element.setAttribute('id', this.writer.getUniqueId('dom_')))
      .unwrap();

    if (lastChild) {
      this.writer.editor?.selection.setCursorLocation(lastChild[0]); // TODO doesn't work with spans on Chrome (at least)
    }

    this.writer.editor?.undoManager.add();
    this.writer.event('contentChanged').publish();
  }

  /**
   * Merge the contents of multiple tags into the first tag.
   * @param {Array} tags An array of tags (Element or jQuery) to merge
   */
  mergeTags(tags: JQuery<HTMLElement>) {
    let newHtml = '';
    const nodesToRemove: string[] = [];

    for (let i = 0; i < tags.length; i++) {
      const $tag = $(tags[i]);
      newHtml += $tag.html();
      if (i > 0) nodesToRemove.push(`#${$tag.attr('id')}`);
    }

    $(tags[0]).html(newHtml);
    $(nodesToRemove.join(','), this.writer.editor?.getBody()).remove();

    this.writer.editor?.undoManager.add();
    this.writer.event('contentChanged').publish();
  }

  /**
   * Process newly added content
   * @param {Element} domContent
   */
  processNewContent(domContent: Element) {
    const processNewNodes = (currNode: Element | Node, direction: 'up' | 'down') => {
      if (currNode.nodeType === Node.ELEMENT_NODE) {
        const currNodeElement = currNode as Element;

        if (currNodeElement.hasAttribute('_tag')) {
          const oldId = currNodeElement.getAttribute('id');

          if (oldId) {
            const instances = currNodeElement.ownerDocument.querySelectorAll(`#${oldId}`);
            if (instances.length === 1) return;
          }

          const newId = this.writer.getUniqueId('dom_');
          currNodeElement.setAttribute('id', newId);

          if (oldId && currNodeElement.hasAttribute('_entity')) {
            currNodeElement.setAttribute('name', newId);
            const oldEntity = this.writer.entitiesManager.getEntity(oldId);

            if (oldEntity) {
              const newEntity = oldEntity.clone();
              newEntity.setId(newId);
              this.writer.entitiesManager.setEntity(newId, newEntity);
            } else {
              log.warn(`processNewContent: copied entity tag had no Entity to clone for ${oldId}`);

              const tag = currNodeElement.getAttribute('_tag');
              const type = currNodeElement.getAttribute('_type');
              if (tag && type) {
                this.writer.entitiesManager.addEntity({ id: newId, tag, type });
              }
            }
          }
        }
      }

      if (direction === 'up' && currNode.parentElement) {
        processNewNodes(currNode.parentElement, direction);
      }

      if (direction === 'down') {
        for (let i = 0; i < currNode.childNodes.length; i++) {
          processNewNodes(currNode.childNodes[i], direction);
        }
      }
    };

    processNewNodes(domContent, 'up');
    processNewNodes(domContent, 'down');

    // TODO overlapping entities handling
    /*
        this.writer.entitiesManager.eachEntity((id, entity) => {
          const match = $('[name="'+id+'"]', this.writer.editor?.getBody());
          if (match.length > 1) {
            match.each((index, el) => {
              if (index > 0) {
                const newEntity = this.writer.entitiesManager.cloneEntity(id);
                const newId = newEntity.getId();
                this.writer.entitiesManager.setEntity(newId, newEntity);
                
                const newTagStart = $(el);
                const newTags = this.getCorrespondingEntityTags(newTagStart);
                
                newTagStart.attr('name', newId);
                if (newTagStart.attr('id')) newTagStart.attr('id', newId);
                newTags.each((index, tag) => $(tag).attr('name', newId));
              }
            });
          }
        });
      */
  }

  /**
   * Add the remaining entity info to its entry
   * @protected
   * @param {String} type Then entity type
   * @param {Object} info The entity info // *IcurrentData at Dialogforms
   */
  finalizeEntity(type: string, info: any) {
    if (!this.writer.editor) return;

    const isNamedEntity = this.writer.schemaManager.mapper.isNamedEntity(type);
    const tagName = this.writer.schemaManager.mapper.getParentTag(type);

    if (type === 'note') delete info.attributes.otherType; //remove otherType attribute;

    this.sanitizeObject({ obj: info.attributes, isAttributes: true });
    this.sanitizeObject({ obj: info.customValues, isAttributes: false });

    if (!isNamedEntity || (isNamedEntity && info.properties.uri)) {
      const config = {
        id: this.writer.getUniqueId('dom_'),
        type,
        isNote: this.writer.schemaManager.mapper.isEntityTypeNote(type),
        isNamedEntity,
        tag: tagName,
        attributes: info.attributes,
        customValues: info.customValues,
      };

      if (info.properties && info.properties.noteContent) {
        if (!info.properties.content || info.properties.content === '') {
          info.properties.content = info.properties.noteContent;
        }
      }

      $.extend(config, info.properties);

      this.writer.editor.selection.moveToBookmark(this.writer.editor.currentBookmark);
      const range: Range = this.writer.editor.selection.getRng();

      this.writer.entitiesManager.addEntity(config, range);
    } else {
      this.addStructureTag({
        action: this.ADD,
        attributes: info.attributes,
        bookmark: this.writer.editor.currentBookmark,
        tagName,
      });
    }

    // TODO is this necessary?
    this.writer.editor.currentBookmark = null;
    this.writer.editor.focus();
  }

  /**
   * Update the entity info
   * @fires Writer#entityEdited
   * @param {String} id The entity id
   * @param {Object} info The entity info // *IcurrentData at Dialogforms
   * @param {Object} info.attributes Key/value pairs of attributes
   * @param {Object} info.properties Key/value pairs of Entity properties
   * @param {Object} info.customValues Any additional custom values
   */
  editEntity(id: string, info: any) {
    this.sanitizeObject({ obj: info.attributes, isAttributes: true });
    this.sanitizeObject({ obj: info.customValues, isAttributes: false });

    const entity = this.writer.entitiesManager.getEntity(id);
    const $tag = $(`[name=${id}]`, this.writer.editor?.getBody());

    const type: string = info.properties.type || entity.getType();
    if (type !== entity.getType()) {
      log.info('tagger.editEntity: changing entity type'); // only possible via nerve
    }

    // named entity check
    const isNamedEntity = this.writer.schemaManager.mapper.isNamedEntity(type);
    const uriAttribute = this.writer.schemaManager.mapper.getAttributeForProperty(type, 'uri');
    const removeEntity =
      isNamedEntity && (uriAttribute && info.attributes[uriAttribute]) === undefined;

    if (removeEntity) {
      this.setAttributesForTag($tag[0], info.attributes);
      //  tagger.removeEntity(id);
      return;
    }

    this.writer.entitiesManager.editEntity(entity, info);

    this.setAttributesForTag($tag[0], entity.getAttributes());

    $tag.attr('_tag', entity.getTag());
    $tag.attr('_type', entity.getType());
    $tag.attr('class', `entity start end ${entity.getType()}`);

    // TODO rework the use of textTag so that this actually works
    // if (info.properties.content !== undefined && info.properties.content !== entity.getContent()) {
    //   if (entity.isNote()) {
    //     const textTag = this.writer.schemaManager.mapper.getTextTag(entity.getType());
    //     $tag.find(`[_tag=${textTag}]`).text(info.properties.content);
    //   }
    // }

    this.writer.event('entityEdited').publish(id);
  }

  /**
   * Paste a previously copied entity
   * @fires Writer#entityPasted
   */
  pasteEntity() {
    if (!this.writer.editor) return;
    this.doPaste(this.writer.editor.copiedEntity);
    this.writer.editor.copiedEntity = null;
  }

  /**
   * Removes the entity annotation and converts the entity back to a tag.
   * @fires Writer#entityRemoved
   * @param {String} entityId
   * @returns {Element} The tag
   */
  removeEntity(entityId?: string | string[]) {
    if (!this.writer.editor) return;

    //? what to do if id is multiple
    if (Array.isArray(entityId)) entityId = entityId[0];

    if (!entityId) {
      const currentEntity = this.writer.entitiesManager.getCurrentEntity();
      if (!currentEntity) return;
      entityId = currentEntity;
    }

    const entity = this.writer.entitiesManager.getEntity(entityId);
    const $tag = $(`#${entityId}`, this.writer.editor.getBody());

    const tagName = $tag.attr('_tag');
    if (!tagName) return;

    const attributes = this.getAttributesForTag($tag[0]);
    const hasSelection = this.writer.editor.selection.getRng(true).collapsed === false;

    if (entity.isNote()) this.removeNoteWrapper($tag);

    // replace tag with tempSelection span
    $tag.wrapInner('<span id="tempSelection"/>');
    const $temp = $('#tempSelection', this.writer.editor.getBody());
    $temp.unwrap();

    this.writer.entitiesManager.removeEntity(entityId);

    // bookmark temp selection
    const rng: Range = this.writer.editor.selection.getRng(true);
    rng.selectNodeContents($temp[0]);
    this.writer.editor.currentBookmark = this.writer.editor.selection.getBookmark(1);

    const newTag = this.addStructureTag({
      action: this.ADD,
      attributes,
      bookmark: this.writer.editor.currentBookmark,
      tagName,
    });

    const contents = $temp.contents();
    contents.unwrap(); // remove tempSelection span

    if (hasSelection) this.doReselect(contents);

    // TODO how to undo this?
    // this.writer.editor?.undoManager.add();

    return newTag;
  }

  /**
   * Add an entity tag.
   * @param {Entity} entity The entity to tag
   * @param {Range} range The DOM range to apply the tag to
   */
  addEntityTag(entity: Entity, range: Range) {
    const id = entity.getId();
    const type = entity.getType();
    const parentTag = entity.getTag() ?? this.writer.schemaManager.mapper.getParentTag(type);

    const tagAttributes: { [key: string]: string } = {};
    for (const key in entity.attributes) {
      // if (Mapper.reservedAttributes[key] !== true) {
      //   tagAttributes[key] = entity.attributes[key];
      // }
      if (!RESERVED_ATTRIBUTES.has(key)) {
        tagAttributes[key] = entity.attributes[key];
      }
    }

    let jsonAttrsString = JSON.stringify(tagAttributes);
    jsonAttrsString = jsonAttrsString.replace(/"/g, '&quot;');

    if (entity.isNote()) {
      const enityNoteContent = entity.getNoteContent() ?? '';
      const noteContent = this.writer.utilities.convertTextForExport(enityNoteContent);

      // const textTag = this.writer.schemaManager.mapper.getTextTag(entity.getType());
      // if (textTag) {
      //   const textTagId = this.writer.getUniqueId('dom_');
      //   noteContent = `<span id="${textTagId}" _tag="${textTag}">${noteContent}</span>`;
      // }

      const tag: Element = this.writer.editor?.dom.create(
        'span',
        $.extend(tagAttributes, {
          _entity: true,
          _note: true,
          _tag: parentTag,
          _type: type,
          class: `entity ${type} start end`,
          name: id,
          id,
          _attributes: jsonAttrsString,
        }),
        noteContent
      );

      const sel = this.writer.editor?.selection;
      sel.setRng(range);

      // chrome seems to mess up the range slightly if not set again
      //@ts-ignore
      if (tinymce.isWebKit) sel.setRng(range);

      sel.collapse(false);
      range = sel.getRng(true);
      range.insertNode(tag);

      this.addNoteWrapper(tag, type);
    } else {
      if (range.startContainer.parentNode !== range.endContainer.parentNode) {
        const nodes = this.getNodesInBetween(
          range.startContainer,
          range.endContainer,
          NodeFilter.SHOW_TEXT
        );

        const startRange = range.cloneRange();

        //? range.startContainer.length -> range.range.startOffset?
        startRange.setEnd(range.startContainer, range.startContainer.length);

        const start: Element = this.writer.editor?.dom.create(
          'span',
          {
            _entity: true,
            _type: type,
            class: `entity ${type} start`,
            name: id,
            _attributes: jsonAttrsString,
          },
          ''
        );
        startRange.surroundContents(start);

        $.each(nodes, (index, node) => {
          $(node).wrap(`
            <span _entity="true" _type="${type}" class="entity ${type}" name="${id}" />
          `);
        });

        const endRange = range.cloneRange();
        endRange.setStart(range.endContainer, 0);

        const end: Element = this.writer.editor?.dom.create(
          'span',
          {
            _entity: true,
            _type: type,
            class: `entity ${type} end`,
            name: id,
          },
          ''
        );
        endRange.surroundContents(end);
      } else {
        const start: Element = this.writer.editor?.dom.create(
          'span',
          $.extend(tagAttributes, {
            _entity: true,
            _tag: parentTag,
            _type: type,
            class: `entity ${type} start end`,
            name: id,
            id,
            _attributes: jsonAttrsString,
          }),
          ''
        );
        range.surroundContents(start);
      }
    }

    this.writer.editor?.undoManager.add();
  }

  addNoteWrapper = (tag: Element, type: string) => {
    $(tag)
      .filter(':visible') //! don't add to invisible tags
      .wrap(`<span class="noteWrapper ${type} hide" title="${tag.textContent}" />`)
      .parent()
      .on('click', ({ target }) => {
        const $target = $(target);
        if ($target.hasClass('noteWrapper')) $target.toggleClass('hide');
      });
  };

  addNoteWrappersForEntities() {
    this.writer.entitiesManager.eachEntity((id: string, entity: Entity) => {
      if (entity.isNote()) {
        const note = $(`#${id}`, this.writer.editor?.getBody());
        this.addNoteWrapper(note[0], entity.getType());
      }
    });
  }

  removeNoteWrapper(tag: JQuery<HTMLElement>) {
    $(tag).unwrap('.noteWrapper');
  }

  // remove all the noteWrapper elements.
  // needed when running evaluateXPath on cwrc docs and used in conjunction with addNoteWrappersForEntities.
  removeNoteWrappersForEntities() {
    this.writer.entitiesManager.eachEntity((id: string, entity: Entity) => {
      if (entity.isNote()) {
        this.removeNoteWrapper($(`#${id}`, this.writer.editor?.getBody()));
      }
    });
  }

  /**
   * Adds a structure tag to the document, based on the params.
   * @fires Writer#tagAdded
   * @param {String} tagName The tag name
   * @param {Object} attributes The tag attributes
   * @param {Object} bookmark A tinymce bookmark object, with an optional custom tagId property
   * @param {String} action Where to insert the tag, relative to the bookmark (before, after, around, inside); can also be null
   * @returns {Element} The new tag
   */
  addStructureTag({
    action,
    attributes,
    bookmark,
    tagName,
  }: {
    action: Action;
    attributes: { [x: string]: any };
    bookmark: Bookmark | { tagId: string | undefined };
    tagName: string;
  }) {
    this.sanitizeObject({ obj: attributes, isAttributes: true });

    const id = this.writer.getUniqueId('dom_');

    let $node: JQuery<any>;
    if ('tagId' in bookmark) {
      // this is used when adding tags through the context menu, or the translation dialog
      $node = Array.isArray(bookmark.tagId)
        ? $(`#${bookmark.tagId.join(',#')}`, this.writer.editor?.getBody())
        : $(`#${bookmark.tagId}`, this.writer.editor?.getBody());
    } else {
      // this is meant for user text selections
      let node = bookmark.rng.commonAncestorContainer;
      while (
        node.nodeType == Node.TEXT_NODE ||
        (node.nodeType == Node.ELEMENT_NODE && !node.hasAttribute('_tag'))
      ) {
        node = node.parentNode;
      }
      $node = $(node);
    }

    // noteWrapper handling
    let $noteWrapper: JQuery<any> | null = null;
    const noteAttr_tag = $node.attr('_tag');
    const entityType = noteAttr_tag
      ? this.writer.schemaManager.mapper.getEntityTypeForTag(noteAttr_tag)
      : null;

    if (entityType && this.writer.schemaManager.mapper.isEntityTypeNote(entityType)) {
      $noteWrapper = $node.parent('.noteWrapper');
    }

    const editorTagName = this.writer.schemaManager.getTagForEditor(tagName);
    let open_tag = `<${editorTagName} id="${id}" _tag="${tagName}"`;

    const jsonAttrs: { [key: string]: any } = {};
    for (const key in attributes) {
      // if (Mapper.reservedAttributes[key] !== true) {
      //   // if (reservedAttributes.get(key) !== true) {
      //   open_tag += ` ${key}="${attributes[key]}"`;
      // }
      if (!RESERVED_ATTRIBUTES.has(key)) {
        open_tag += ` ${key}="${attributes[key]}"`;
      }

      jsonAttrs[key] = attributes[key];
    }

    let jsonAttrsString = JSON.stringify(jsonAttrs);
    jsonAttrsString = jsonAttrsString.replace(/"/g, '&quot;');
    open_tag += ` _attributes="${jsonAttrsString}">`;

    const close_tag = '</' + editorTagName + '>';

    let selection = '\uFEFF';
    let content = `${open_tag}${selection}${close_tag}`;

    switch (action) {
      case this.BEFORE:
        $noteWrapper ? $noteWrapper.before(content) : $node.before(content);
        break;

      case this.AFTER:
        $noteWrapper ? $noteWrapper.after(content) : $node.after(content);
        break;

      case this.AROUND:
        if ($node.length > 1) {
          $node.wrapAll(content);
        } else {
          $noteWrapper ? $noteWrapper.wrap(content) : $node.wrap(content);
        }
        break;

      case this.INSIDE:
        $node.wrapInner(content);
        break;

      default:
        // default action = add
        this.writer.editor?.selection.moveToBookmark(bookmark);

        selection = this.writer.editor?.selection.getContent();
        if (selection === '') selection = '\uFEFF';

        content = `${open_tag}${selection}${close_tag}`;

        const range: Range = this.writer.editor?.selection.getRng(true);
        const tempNode = $('<span data-mce-bogus="1">', this.writer.editor?.getDoc());
        range.surroundContents(tempNode[0]);
        tempNode.replaceWith(content);
        break;
    }

    const newTag = $(`#${id}`, this.writer.editor?.getBody());
    this.writer.event('tagAdded').publish(newTag[0]);

    this.writer.editor?.undoManager.add();

    if (selection === '\uFEFF') {
      this.writer.utilities.selectElementById(id, true);
    } else if (action == undefined) {
      // place the cursor at the end of the tag's contents
      const rng: Range = this.writer.editor?.selection.getRng(true);
      rng.selectNodeContents($(`#${id}`, this.writer.editor?.getBody())[0]);
      rng.collapse(false);
      this.writer.editor?.selection.setRng(rng);
    }

    return newTag[0];
  }

  /**
   * Change the attributes of a tag, or change the tag itself.
   * @fires Writer#tagEdited
   * @param tag {jQuery} A jQuery representation of the tag
   * @param attributes {Object} An object of attribute names and values
   * @param [tagName] {String} A new tag name for this tag (optional)
   */
  editStructureTag(tag: JQuery<any>, attributes: any, tagName?: string | undefined) {
    this.sanitizeObject({ obj: attributes, isAttributes: true });

    const id = tag.attr('id');

    if (tagName && tagName !== tag.attr('_tag')) {
      // change the tag
      const editorTagName = tag.parent().is('span')
        ? // force inline if parent is inline
          'span'
        : this.writer.schemaManager.getTagForEditor(tagName);

      tag.contents().unwrap().wrapAll(`<${editorTagName} id="${id}" _tag="${tagName}"/>`);

      tag = $(`#${id}`, this.writer.editor?.getBody());
    }

    this.setAttributesForTag(tag[0], attributes);

    this.writer.event('tagEdited').publish(tag[0]);
  }

  /**
   * Remove a structure tag
   * @fires Writer#tagRemoved
   * @param {String} [id] The tag id
   * @param {Boolean} [removeContents] True to remove tag contents as well
   */
  removeStructureTag(id: string | string[], removeContents?: boolean) {
    //? what to do if id is multiple
    if (Array.isArray(id)) id = id[0];

    if (removeContents === undefined) {
      if (
        this.writer.tree &&
        this.writer.tree.currentlySelectedNodes.length > 0 &&
        this.writer.tree.selectionType != null
      ) {
        removeContents = true;
      } else {
        removeContents = false;
      }
    }

    const doRemove = () => {
      if (removeContents) {
        if (entry && entry.isNote()) {
          this.processRemovedContent(tag.parent('.noteWrapper')[0]);
          tag.parent('.noteWrapper').remove();
        } else {
          this.processRemovedContent(tag[0]);
          tag.remove();
        }
      } else {
        this.processRemovedContent(tag[0], false);

        const hasSelection = this.writer.editor?.selection.getRng(true).collapsed === false;

        const parent = tag.parent();
        let contents = tag.contents();

        contents.length > 0 ? contents.unwrap() : tag.remove();

        if (entry && entry.isNote()) {
          this.processRemovedContent(parent[0], false);
          contents = parent.contents();

          contents.length > 0 ? contents.unwrap() : parent.remove();
        }

        if (hasSelection) this.doReselect(contents);

        parent[0].normalize();
      }

      this.writer.editor?.undoManager.add();
      this.writer.event('tagRemoved').publish(id);
    };

    const tag = this.getCurrentTag(id) as JQuery<HTMLElement>;
    const entry = this.writer.entitiesManager.getEntity(id);
    // id = tag.attr('id') ?? id;

    const invalidDelete = this.writer.schemaManager.wouldDeleteInvalidate({
      contextNode: tag[0],
      removeContext: true,
      removeContents,
    });

    if (invalidDelete) {
      this.showInvalidDeleteConfirm(tag[0], false, (confirmed: boolean) => {
        if (confirmed) doRemove();
      });
      return;
    }

    doRemove();
  }

  /**
   * Remove a structure tag's contents
   * @fires Writer#tagContentsRemoved
   * @param {String} [id] The tag id
   */
  removeStructureTagContents(id: string | string[]) {
    //? what to do if id is multiple
    if (Array.isArray(id)) id = id[0];

    const tag = this.getCurrentTag(id) as JQuery<HTMLElement>;

    const doRemove = () => {
      tag
        .contents()
        .each((i, el) => this.processRemovedContent(el))
        .remove();

      tag[0].textContent = '\uFEFF'; // insert zero-width non-breaking space so that empty tag isn't cleaned up by tinymce

      this.writer.editor?.undoManager.add();
      this.writer.event('tagContentsRemoved').publish(id);
    };

    const invalidDelete = this.writer.schemaManager.wouldDeleteInvalidate({
      contextNode: tag[0],
      removeContext: false,
      removeContents: true,
    });

    if (invalidDelete) {
      this.showInvalidDeleteConfirm(tag[0], true, (confirmed: boolean) => {
        if (confirmed) doRemove();
      });
      return;
    }

    doRemove();
  }

  /**
   * Look for removed entities
   * @param {Element|Range} domContent
   * @param {Boolean} [processChildren] True to also process the children of domContent. Defaults to true.
   */
  processRemovedContent(domContent: Element | Range, processChildren = true) {
    const processRemovedNodes = (currNode: Node | Element) => {
      if (
        currNode.nodeType === Node.ELEMENT_NODE &&
        'hasAttribute' in currNode &&
        currNode.hasAttribute('_tag') &&
        currNode.hasAttribute('_entity')
      ) {
        const id = currNode.getAttribute('name');
        if (id) {
          log.info('entity will be removed', id);
          this.writer.entitiesManager.removeEntity(id);
        }
      } else {
        // if node was inside a note, set note content after the node's been removed
        const $noteParent = $(currNode).parents('[_type=citation],[_type=note]');
        if ($noteParent.length > 0) {
          setTimeout(() => {
            $noteParent.each((index, element) => {
              const $el = $(element);

              const id = $el.attr('id');
              if (!id) return;

              const entity = this.writer.entitiesManager.getEntity(id);
              entity.setNoteContent($el.html());
              entity.setContent($el.text());
              this.writer.event('entityEdited').publish(id);
            });
          }, 0);
        }
      }

      if (processChildren) {
        for (let i = 0; i < currNode.childNodes.length; i++) {
          processRemovedNodes(currNode.childNodes[i]);
        }
      }
    };

    if ('commonAncestorContainer' in domContent) {
      // range
      processChildren = false;
      const nodes = this.getNodesInBetween(domContent.startContainer, domContent.endContainer);
      nodes.forEach((node) => processRemovedNodes(node));
    } else {
      processRemovedNodes(domContent);
    }
  }

  /**
   * Converts string values of this object into valid XML strings
   * @param {Object} obj The object of strings/arrays/objects
   * @param {Boolean} isAttributes Are these attributes?
   */
  private sanitizeObject({ obj, isAttributes }: { obj: any; isAttributes?: boolean }) {
    for (const key in obj) {
      const val = obj[key];
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          obj[key][i] = this.writer.utilities.convertTextForExport(val[i], isAttributes);
        }
      } else if ($.isPlainObject(val)) {
        for (const subkey in val) {
          obj[key][subkey] = this.writer.utilities.convertTextForExport(val[subkey], isAttributes);
        }
      } else {
        if (typeof val === 'string') {
          obj[key] = this.writer.utilities.convertTextForExport(val, isAttributes);
        }
      }
    }
  }

  /**
   * Performs a paste using the specified element at the current cursor point
   * @param {Element} element
   */
  private doPaste(element: Element) {
    if (!element) return;

    this.writer.editor?.selection.moveToBookmark(this.writer.editor?.currentBookmark);

    const sel = this.writer.editor?.selection;
    sel.collapse();
    const rng: Range = sel.getRng(true);
    rng.insertNode(element);

    this.processNewContent(element);

    this.writer.editor?.undoManager.add();
    this.writer.event('contentChanged').publish(); // don't use contentPasted since we don't want to trigger copyPaste dialog
  }

  private showInvalidDeleteConfirm(
    element: Element,
    isContents: boolean,
    callback: (confirmed: boolean) => void
  ) {
    const showConfirmKey = 'confirm-delete-tag-invalidating';
    const contentsMsg = isContents ? 'contents of the' : '';
    const _tagAttribute = element.getAttribute('_tag');
    const msg = `
      <p>Deleting the ${contentsMsg} "${_tagAttribute}" element will make the document invalid. Do you wish to continue?</p>
    `;

    this.writer.dialogManager.confirm({
      title: 'Warning',
      msg,
      showConfirmKey,
      type: 'info',
      callback,
    });
  }

  /**
   * Re-select the contents of a node that's been removed
   * @param {jQuery} contents A selection of nodes
   */
  private doReselect(contents: any[] | JQuery<any>) {
    const rng: Range = this.writer.editor?.selection.getRng(true);
    contents = contents.toArray().filter((element) => {
      return element.parentNode !== null; // if the node doesn't have a parent then we can't select it
    });

    if (contents.length > 0) {
      if (contents.length === 1) {
        rng.selectNodeContents(contents[0]);
      } else {
        // TODO selecting multiple nodes and then trying to add a tag doesn't work properly yet
        // rng.setStartBefore(contents[0]);
        // rng.setEndAfter(contents[contents.length-1]);
      }
    }
  }

  /**
   * Checks the user selection for overlap issues and entity markers.
   * @param {Boolean} isStructTag Is the tag a structure tag
   * @param {Boolean} cleanRange True to remove extra whitespace and fix text range that spans multiple parents
   * @returns {Integer}
   */
  private isSelectionValid({
    isStructTag,
    cleanRange,
  }: {
    isStructTag: boolean;
    cleanRange: boolean;
  }) {
    const sel = this.writer.editor?.selection;

    // disallow empty entities
    if (!isStructTag && sel.isCollapsed()) return this.NO_SELECTION;

    const range: Range = sel.getRng(true);
    range.commonAncestorContainer.normalize(); // normalize/collapse separate text nodes

    // fix for select all and root node select
    if (range.commonAncestorContainer.nodeName.toLowerCase() === 'body') {
      const root = this.writer.editor?.dom.select('body > *')[0];
      range.setStartBefore(root.firstChild);
      range.setEndAfter(root.lastChild);
    }

    function findTextNode(node: Node, direction: 'back' | 'forward') {
      function doFind(currNode: Node, dir: 'back' | 'forward', reps: number): ChildNode | null {
        // prevent infinite recursion
        if (reps > 20) return null;

        let newNode: ChildNode | null | undefined;
        if (dir === 'back') {
          newNode =
            currNode.lastChild || currNode.previousSibling || currNode.parentNode?.previousSibling;
        }
        if (dir === 'forward') {
          newNode = currNode.firstChild || currNode.nextSibling || currNode.parentNode?.nextSibling;
        }

        if (!newNode) return null;
        if (newNode.nodeType == Node.TEXT_NODE) return newNode;

        return doFind(newNode, dir, reps++);
      }

      return doFind(node, direction, 0);
    }

    // TODO rework this
    // fix for when start and/or end containers are element nodes
    if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
      const end = range.endContainer;

      if (end.nodeType !== Node.TEXT_NODE || range.endOffset === 0) {
        const endTextNode = findTextNode(range.endContainer, 'back');
        if (!endTextNode) return this.NO_COMMON_PARENT;

        range.setEnd(endTextNode, end.length);
      }
      const start = findTextNode(range.startContainer, 'forward');
      if (!start) return this.NO_COMMON_PARENT;

      range.setStart(start, 0);
    }

    if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
      // don't need to check nodeType here since we've already ensured startContainer is text
      range.setEnd(range.startContainer, range.startContainer.length);
    }

    /**
     * Removes whitespace surrounding the range.
     * Also fixes cases where the range spans adjacent text nodes with different parents.
     */
    function fixRange(range: Range) {
      const content = range.toString();

      const matchLeadingSpaces = content.match(/^\s+/);
      const leadingSpaces = matchLeadingSpaces ? matchLeadingSpaces[0].length : 0;

      const matchTrailingSpaces = content.match(/\s+$/);
      const trailingSpaces = matchTrailingSpaces ? matchTrailingSpaces[0].length : 0;

      function shiftRangeForward(range: Range, count: number, reps: number) {
        if (count > 0 && reps < 20) {
          if (range.startOffset < range.startContainer.length) {
            range.setStart(range.startContainer, range.startOffset + 1);
            count--;
          }
          if (range.startOffset === range.startContainer.length) {
            const nextTextNode = findTextNode(range.startContainer, 'forward');
            if (nextTextNode) range.setStart(nextTextNode, 0);
          }
          shiftRangeForward(range, count, reps++);
        }
      }

      function shiftRangeBackward(range: Range, count: number, reps: number) {
        if (count > 0 && reps < 20) {
          if (range.endOffset > 0) {
            range.setEnd(range.endContainer, range.endOffset - 1);
            count--;
          }
          if (range.endOffset == 0) {
            const prevTextNode = findTextNode(range.endContainer, 'back');
            if (prevTextNode) range.setEnd(prevTextNode, prevTextNode.length);
          }
          shiftRangeBackward(range, count, reps++);
        }
      }

      shiftRangeForward(range, leadingSpaces, 0);
      shiftRangeBackward(range, trailingSpaces, 0);

      sel.setRng(range);
    }

    if (cleanRange) fixRange(range);

    // TODO add handling for when inside overlapping entity tags
    if (range.startContainer.parentNode != range.endContainer.parentNode) {
      if (
        range.endOffset === 0 &&
        range.endContainer.previousSibling === range.startContainer.parentNode
      ) {
        // fix for when the user double-clicks a word that's already been tagged
        range.setEnd(range.startContainer, range.startContainer.length);
      } else {
        return isStructTag ? this.NO_COMMON_PARENT : this.OVERLAP;
      }
    }

    // extra check to make sure we're not overlapping with an entity
    if (isStructTag || this.writer.allowOverlap === false) {
      let $currentNode: JQuery<any>;
      let currentNode: any = range.startContainer;
      const ents: { [x: string]: boolean } = {};

      while (currentNode !== range.endContainer) {
        currentNode = currentNode.nextSibling;
        $currentNode = $(currentNode);

        const attrName = $currentNode.attr('name');
        if ($currentNode.attr('_entity') && $currentNode.attr('_tag') && attrName) {
          if (ents[attrName]) {
            delete ents[attrName];
          } else {
            ents[attrName] = true;
          }
        }
      }
      let count = 0;
      for (const id in ents) {
        count++;
      }

      if (count !== 0) return this.OVERLAP;
    }

    return this.VALID;
  }

  /**
   * Get the entity boundary tag (and potential inbetween tags) that corresponds to the passed tag.
   * @param {element} tag
   * @returns {jQuery}
   */
  private getCorrespondingEntityTags(tag: any[] | JQuery<any>) {
    tag = $(tag);
    if (tag.hasClass('start') && tag.hasClass('end')) return tag;

    const boundaryType = tag.hasClass('start') ? 'end' : 'start';

    const currentNode: Element = tag[0];
    const nodeId = currentNode.getAttribute('name');

    const walker = currentNode.ownerDocument.createTreeWalker(
      currentNode.ownerDocument,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Element) => {
          return node.getAttribute('name') === nodeId
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      }
    );
    walker.currentNode = currentNode;

    const nodes: Node[] = [];

    while (walker.currentNode.getAttribute('name') === nodeId) {
      const result = boundaryType === 'start' ? walker.previousNode() : walker.nextNode();
      if (!result) break;

      nodes.push(walker.currentNode);
      if ($(walker.currentNode).hasClass(boundaryType)) break;
    }

    return $(nodes);
  }

  /**
   * Returns an array of the nodes in between the specified start and end nodes
   * @param {Node} start The start node
   * @param {Node} end The end node
   * @param {NodeFilter} [filter] The NodeFilter, defaults to NodeFilter.SHOW_ALL
   */
  private getNodesInBetween(start: Node, end: Node, filter: number = NodeFilter.SHOW_ALL) {
    const nodes: Node[] = [];

    const walker = start.ownerDocument?.createTreeWalker(start.ownerDocument, filter, null);
    if (!walker) return [];

    walker.currentNode = start;
    while (walker.nextNode()) {
      if (walker.currentNode === end) {
        break;
      }
      nodes.push(walker.currentNode);
    }

    // nodes = nodes.filter((n) => {
    //   if (n.nodeType === Node.ELEMENT_NODE) {
    //     if ((filterEntities && n.getAttribute('_entity')) || n.getAttribute('data-mce-bogus')) {
    //       return false;
    //     }
    //   }
    //   return true;
    // });

    return nodes;
  }
}

export default Tagger;
