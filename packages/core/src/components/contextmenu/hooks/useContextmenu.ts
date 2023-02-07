import type {
  ElementDetail,
  GetValidTagsAtParameters,
  GetValidTagsAtParametersSelection,
} from '@cwrc/leafwriter-validator';
import $ from 'jquery';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EntityTypes } from '../../../js/schema/types';
import type { Action } from '../../../js/tagger';
import Writer from '../../../js/Writer';
import { useActions, useAppState } from '../../../overmind';
import type { ContextMenuState } from '../../../types';
import { log } from '../../../utilities';
import type { ItemProps } from '../collection/Item';

export const useContextmenu = (writer?: Writer, contextMenuState?: ContextMenuState) => {
  const actions = useActions();
  const { editor, ui } = useAppState();
  const [collectionType, setCollectionType] = useState<string>();
  const [xpath, setXpath] = useState<string>();
  const [tagName, setTagName] = useState<string>();
  const [tagMeta, setTagMeta] = useState<ElementDetail | undefined>();

  useEffect(() => {
    return () => {
      setCollectionType('');
      setXpath('');
      setTagName('');
      setTagMeta(undefined);
    };
  }, []);

  useEffect(() => {
    return () => {
      setTagMeta(undefined);
    };
  }, [tagMeta]);

  const context: ContextMenuState = contextMenuState ? { ...ui.contextMenu } : { show: false };

  const selectionOverlapNodes = (_rng: Range) => {
    const { startContainer, endContainer } = _rng;

    if (startContainer.nodeType !== Node.TEXT_NODE || endContainer.nodeType !== Node.TEXT_NODE) {
      return false;
    }

    // if (!startContainer.parentElement || !endContainer.parentElement) return false;

    // if (
    //   startContainer.parentElement.nodeType === Node.ELEMENT_NODE &&
    //   endContainer.parentElement.nodeType !== Node.ELEMENT_NODE
    // ) {
    //   if (startContainer.parentElement.id !== endContainer.parentElement.id) {
    //     return false;
    //   }
    // }

    //? Doublecheck
    //@ts-ignore
    if (startContainer.parentNode.id !== endContainer.parentNode?.id) {
      return false;
    }

    return true;
  };

  const getEntitiesOptions = () => {
    if (!writer) return [];

    const type = 'entity';
    const entityMappings = writer.schemaManager.mapper.getMappings().entities;

    const options = [...entityMappings].map(
      ([key, { label }]: [EntityTypes, { label?: string }]) => {
        const displayName = label ? label : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;

        const item: ItemProps = {
          id: uuidv4(),
          type,
          name: key,
          displayName,
          icon: key,
          onClick: () => writer.tagger.addEntityDialog(key),
        };
        return item;
      }
    );

    return options;
  };

  const paramsForAddTag = () => {
    if (!writer || !context.rng || !context.element) return;
    const rng = context.rng;

    const xpath = writer.utilities.getElementXPath(context.element);
    if (!xpath) return;

    const elementChildren = Array.from(context.element.childNodes);
    const index = elementChildren.findIndex((child) => child === rng.startContainer);

    const request: GetValidTagsAtParameters = { xpath, index };

    if (context.hasContentSelection) {
      request.selection = {
        type: 'span',
        startContainerIndex: index,
        startOffset: rng.startOffset,
        endContainerIndex: elementChildren.findIndex((child) => child === rng.endContainer),
        endOffset: rng.endOffset,
      };
    }

    return request;
  };

  const paramsForChangeTag = () => {
    if (!writer || !context.element || !context.element.parentNode) return;

    const parentNode = context.element.parentNode as Element;

    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const elementChildren = Array.from(context.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === context.element);
    const skip = context.element.getAttribute('_tag') ?? undefined;

    const selectionXpath = writer.utilities.getElementXPath(context.element);

    const selection: GetValidTagsAtParametersSelection = {
      type: 'change',
      xpath: selectionXpath ?? '',
      startContainerIndex: 0,
      endContainerIndex: elementChildren.length,
      skip,
    };

    const request: GetValidTagsAtParameters = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagBefore = () => {
    if (!writer || !context.element || !context.element.parentNode) return;

    const parentNode = context.element.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const index = 0;

    const elementChildren = Array.from(context.element.parentNode.childNodes);
    let containerIndex = elementChildren.findIndex((child) => child === context.element) - 1;
    if (containerIndex < 0) containerIndex = 0;

    const selection: GetValidTagsAtParametersSelection = { type: 'before', xpath, containerIndex };
    const request: GetValidTagsAtParameters = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagAfter = () => {
    if (!writer || !context.element || !context.element.parentNode) return;

    const parentNode = context.element.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const elementChildren = Array.from(context.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === context.element) + 1;

    const selection: GetValidTagsAtParametersSelection = {
      type: 'after',
      xpath,
      containerIndex: index,
    };
    const request: GetValidTagsAtParameters = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagAround = () => {
    if (!writer || !context.element || !context.element.parentNode) return;

    const parentNode = context.element.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const elementChildren = Array.from(context.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === context.element);

    const selectionXpath = writer.utilities.getElementXPath(context.element);

    const selection: GetValidTagsAtParametersSelection = {
      type: 'around',
      xpath: selectionXpath ?? '',
    };
    const request: GetValidTagsAtParameters = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagInside = () => {
    if (!writer || !context.element) return;

    const xpath = writer.utilities.getElementXPath(context.element);
    if (!xpath) return;

    const index = 0;
    const selectionXpath = writer.utilities.getElementXPath(context.element);

    const selection: GetValidTagsAtParametersSelection = {
      type: 'inside',
      xpath: selectionXpath ?? '',
    };
    const request: GetValidTagsAtParameters = { xpath, index, selection };

    return request;
  };

  const getTagsFor = async (params: GetValidTagsAtParameters) => {
    const tags = await actions.validator.getValidTagsAt(params);
    if (!tags) return [];
    return tags;
  };

  const getTagItems = (tags: ElementDetail[], action: Action) => {
    if (!writer) return;

    const menu: ItemProps[] = tags.map(({ name, fullName }) => {
      return {
        id: uuidv4(),
        type: 'tag',
        displayName: name,
        description: fullName,
        onClick: () => {
          if (context.tagId === undefined) return log.warn('No Tag selected');
          writer.editor.currentBookmark = writer.editor?.selection.getBookmark(1);

          context.tagId;
          if (action === 'change') {
            writer.tagger.changeTagDialog(name, context.tagId);
            return;
          }

          //@ts-ignore
          writer.editor.currentBookmark.tagId = context.tagId;
          writer.tagger.addTagDialog({
            tagName: name,
            tagFullname: fullName,
            action,
            parentTagId: context.tagId,
          });
        },
      };
    });

    return menu;
  };

  return {
    collectionType,
    MIN_WIDTH: 250,
    xpath,
    tagName,
    tagMeta,

    query: (list: ItemProps[], searchQuery: string) => {
      if (searchQuery === '') return;
      const _visible = list.filter((item) => {
        if (!item.displayName) return;
        const match = item.displayName.toLowerCase().indexOf(searchQuery.toLowerCase()) != -1;
        return match;
      });
      return _visible;
    },

    initialize: async () => {
      if (!writer || !context) return false;

      // writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);

      if (typeof context.tagId === 'string' && context.tagId === writer.schemaManager.getHeader()) {
        context.isHeader = true;
        setTagName(context.tagId);
        return true;
      }

      //@ts-ignore
      context.rng = writer.editor.currentBookmark.rng;
      if (!context.rng) return null;

      context.element =
        context.rng.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (context.rng.commonAncestorContainer as HTMLElement) // ?double-check
          : context.rng.commonAncestorContainer.parentElement;

      //? double check
      if (!context.element) return null;

      context.tagName = context.element.getAttribute('_tag');
      if (!context.tagName) return null;

      if (typeof context.tagId === 'string' && context.tagName === writer.schemaManager.getRoot()) {
        context.isRoot = true;
        setTagName(context.tagName);
        return true;
      }

      context.hasContentSelection = !context.rng.collapsed;
      context.allowsTagAround = context.hasContentSelection
        ? selectionOverlapNodes(context.rng)
        : true;

      context.tagId = context.tagId ? context.tagId : context.element.id;

      if (context.tagId !== undefined && Array.isArray(context.tagId)) {
        context.isMultiple = true;
        context.isEntity = false;
        context.useSelection = false;
      } else {
        context.isMultiple = false;
        context.isEntity = context.element.getAttribute('_entity') !== null;
        context.useSelection = context.useSelection ? context.useSelection : false;
      }

      const elementXpath = writer.utilities.getElementXPath(context.element);
      if (!elementXpath) return false;

      setXpath(elementXpath);
      setTagName(context.tagName);

      if (!context.element.parentElement) return false;
      const parentXpath = writer.utilities.getElementXPath(context.element.parentElement);
      if (!parentXpath) return false;

      const tag = await actions.validator.getTagAt({
        tagName: context.tagName,
        parentXpath,
        index: 0,
      });

      setTagMeta(tag);

      return true;
    },

    getItems: async () => {
      if (!writer || !context) return false;

      if (context.isHeader) {
        const items = [
          {
            id: uuidv4(),
            displayName: 'Edit Header',
            icon: 'edit',
            onClick: () => {
              //get header content
              const headerEl = writer.editor
                .getBody()
                .querySelector(`[_tag="${writer.schemaManager.getHeader()}"]`);

              const content = writer.converter.buildXMLString(headerEl);

              writer.overmindActions.ui.openDialog({
                type: 'editSource',
                props: { content, type: 'header' },
              });
            },
          },
        ];
        return items;
      }

      if (context.isRoot) {
        const items = [
          {
            id: uuidv4(),
            displayName: 'Edit',
            icon: 'edit',
            onClick: () => context.tagId && writer.tagger.editTagDialog(context.tagId),
          },
        ];
        return items;
      }

      if (context.eventSource === 'ribbon') {
        setCollectionType('tags');
        const params = paramsForAddTag();
        if (!params) return [] as ItemProps[];
        const tags = await getTagsFor(params);
        const items = getTagItems(tags, 'add');
        return items;
      }

      if (editor.isAnnotator) {
        const items = getEntitiesOptions();
        return items;
      }

      if (!context.tagId) return [];

      const items: ItemProps[] = [];

      // if (this.virtualEditorExists && this.isMultiple) {
      if (context.isMultiple) {
        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Add Tag Around',
          icon: 'add',
          childrenItems: async () => {
            const params = paramsForAddTagAround();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'around');
            return items ? items : [];
          },
        });

        items.push({ id: uuidv4(), type: 'divider' });

        if (Array.isArray(context.tagId)) {
          items.push({
            id: uuidv4(),
            displayName: 'Merge Tags',
            icon: 'merge',
            onClick: () => {
              if (!Array.isArray(context.tagId)) return;
              const tags = $(`'#${context.tagId.join(',#')}`, writer.editor?.getBody());
              writer.tagger.mergeTags(tags);
            },
          });
        }
      }

      // if (this.virtualEditorExists && this.useSelection && this.allowsTagAround) {
      if (context.useSelection && context.allowsTagAround) {
        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Add Tag',
          icon: 'add',
          childrenItems: async () => {
            const params = paramsForAddTag();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'add');
            return items ? items : [];
          },
        });

        if (writer.schemaManager.isSchemaCustom() === false) {
          items.push({
            id: uuidv4(),
            displayName: 'Add Entity Annotation',
            icon: 'add',
            childrenItems: getEntitiesOptions(),
          });
        }

        items.push({ id: uuidv4(), type: 'divider' });
      }

      // if (this.virtualEditorExists && !this.useSelection) {
      if (!context.useSelection) {
        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Add Tag Before',
          icon: 'add',
          childrenItems: async () => {
            const params = paramsForAddTagBefore();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'before');
            return items ? items : [];
          },
        });

        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Add Tag after',
          icon: 'add',
          childrenItems: async () => {
            const params = paramsForAddTagAfter();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'after');
            return items ? items : [];
          },
        });

        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Add Tag Around',
          icon: 'add',
          childrenItems: async () => {
            const params = paramsForAddTagAround();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'around');
            return items ? items : [];
          },
        });

        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Add Tag Inside',
          icon: 'add',
          childrenItems: async () => {
            const params = paramsForAddTagInside();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'inside');
            return items ? items : [];
          },
        });

        items.push({ id: uuidv4(), type: 'divider' });
      }

      items.push({
        id: uuidv4(),
        displayName: context.isEntity ? 'Edit Entity Annotation' : 'Edit Tag',
        icon: 'edit',
        onClick: () => context.tagId && writer.tagger.editTagDialog(context.tagId),
      });

      if (!context.isEntity && context.element) {
        const tagName = context.element.getAttribute('_tag');
        if (tagName && writer.schemaManager.isTagEntity(tagName)) {
          items.push({
            id: uuidv4(),
            displayName: 'Convert to Entity Annotation',
            icon: 'edit',
            onClick: () => {
              if (context.element) {
                return writer.schemaManager.mapper.convertTagToEntity(context.element, true);
              }
            },
          });
        }
      }

      // / if (
      //   (this.virtualEditorExists && !this.useSelection) ||
      //   (this.useSelection && !this.hasContentSelection)
      // ) {

      if (!context.useSelection || (context.useSelection && !context.hasContentSelection)) {
        items.push({
          id: uuidv4(),
          collectionType: 'tags',
          displayName: 'Change Tag',
          icon: 'edit',
          childrenItems: async () => {
            const params = paramsForChangeTag();
            if (!params) return [] as ItemProps[];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'change');
            return items ? items : [];
          },
        });
      }

      if (context.isEntity) {
        items.push({
          id: uuidv4(),
          displayName: 'Copy Entity',
          icon: 'copy',
          onClick: () => context.tagId && writer.tagger.copyTag(context.tagId),
        });
      } else {
        items.push({
          id: uuidv4(),
          displayName: 'Copy Tag and Contents',
          icon: 'copy',
          onClick: () => context.tagId && writer.tagger.copyTag(context.tagId),
        });
      }

      if (writer.editor?.copiedElement?.element !== undefined) {
        items.push({
          id: uuidv4(),
          displayName: 'Paste Tag',
          icon: 'paste',
          onClick: () => writer.tagger.pasteTag(),
        });
      } else if (writer.editor?.copiedEntity !== undefined) {
        items.push({
          id: uuidv4(),
          displayName: 'Paste Entity',
          icon: 'paste',
          onClick: () => writer.tagger.pasteEntity(),
        });
      }

      if (context.useSelection) {
        items.push({
          id: uuidv4(),
          displayName: 'Split Tag',
          icon: 'split',
          onClick: () => writer.tagger.splitTag(),
        });
      }

      items.push({ id: uuidv4(), type: 'divider' });

      if (context.isEntity) {
        items.push({
          id: uuidv4(),
          displayName: 'Remove Entity',
          icon: 'remove',
          onClick: () => writer.tagger.removeEntity(context.tagId),
        });
      }

      items.push({
        id: uuidv4(),
        displayName: 'Remove Tag',
        icon: 'remove',
        onClick: () => context.tagId && writer.tagger.removeStructureTag(context.tagId, false),
      });

      items.push({
        id: uuidv4(),
        displayName: 'Remove Content Only',
        icon: 'remove',
        onClick: () => context.tagId && writer.tagger.removeStructureTagContents(context.tagId),
      });

      items.push({
        id: uuidv4(),
        displayName: 'Remove All',
        icon: 'remove',
        onClick: () => context.tagId && writer.tagger.removeStructureTag(context.tagId, true),
      });

      return items;
    },
  };
};
