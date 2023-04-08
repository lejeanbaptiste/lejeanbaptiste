import type {
  NodeDetail,
  Target as PossibleNodesAtTarget,
  TargetSelection as PossibleNodesAtTargetSelection,
} from '@cwrc/leafwriter-validator';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { IconLeafWriter } from '../../../icons';
import type { Action } from '../../../js/tagger';
import { useActions, useAppState } from '../../../overmind';
import type { EntityType } from '../../../types';
import { log } from '../../../utilities';
import type { ItemProps } from '../components';
import { State } from './useContextmenu';

export const useItems = (ctx: State) => {
  const { writer } = window;

  const { isAnnotator } = useAppState().editor;
  const { markupPanel } = useAppState().ui;

  const { openDialog, showTextNodes } = useActions().ui;
  const { getPossibleNodesAt } = useActions().validator;

  const { t } = useTranslation('leafwriter');

  const getEntitiesOptions = () => {
    const type = 'entity';
    const entityMappings = writer.schemaManager.mapper.getMappings().entities;

    const options = [...entityMappings].map(([key, { label }]: [EntityType, { label: string }]) => {
      const item: ItemProps = {
        id: key,
        type,
        name: label,
        icon: key as IconLeafWriter,
        onClick: () => writer.tagger.addEntityDialog(key),
      };
      return item;
    });

    return options;
  };

  const paramsForAddTag = () => {
    if (!ctx.rng || !ctx.element) return;
    const { rng } = ctx;

    const xpath = writer.utilities.getElementXPath(ctx.element);
    if (!xpath) return;

    const elementChildren = Array.from(ctx.element.childNodes);
    const index = elementChildren.findIndex((child) => child === rng.startContainer);

    const request: PossibleNodesAtTarget = { xpath, index };

    if (ctx.hasContentSelection) {
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
    if (!writer || !ctx.element || !ctx.element.parentNode) return;

    const parentNode = ctx.element.parentNode as Element;

    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const elementChildren = Array.from(ctx.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === ctx.element);
    const skip = ctx.element.getAttribute('_tag') ?? undefined;

    const selectionXpath = writer.utilities.getElementXPath(ctx.element);

    const selection: PossibleNodesAtTargetSelection = {
      type: 'change',
      xpath: selectionXpath ?? '',
      startContainerIndex: 0,
      endContainerIndex: elementChildren.length,
      skip,
    };

    const request: PossibleNodesAtTarget = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagBefore = () => {
    if (!writer || !ctx.element || !ctx.element.parentNode) return;

    const parentNode = ctx.element.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const index = 0;

    const elementChildren = Array.from(ctx.element.parentNode.childNodes);
    let containerIndex = elementChildren.findIndex((child) => child === ctx.element) - 1;
    if (containerIndex < 0) containerIndex = 0;

    const selection: PossibleNodesAtTargetSelection = { type: 'before', xpath, containerIndex };
    const request: PossibleNodesAtTarget = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagAfter = () => {
    if (!writer || !ctx.element || !ctx.element.parentNode) return;

    const parentNode = ctx.element.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const elementChildren = Array.from(ctx.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === ctx.element) + 1;

    const selection: PossibleNodesAtTargetSelection = {
      type: 'after',
      xpath,
      containerIndex: index,
    };
    const request: PossibleNodesAtTarget = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagAround = () => {
    if (!writer || !ctx.element || !ctx.element.parentNode) return;

    const parentNode = ctx.element.parentNode as Element;
    const xpath = writer.utilities.getElementXPath(parentNode);
    if (!xpath) return;

    const elementChildren = Array.from(ctx.element.parentNode.childNodes);
    const index = elementChildren.findIndex((child) => child === ctx.element);

    const selectionXpath = writer.utilities.getElementXPath(ctx.element);

    const selection: PossibleNodesAtTargetSelection = {
      type: 'around',
      xpath: selectionXpath ?? '',
    };
    const request: PossibleNodesAtTarget = { xpath, index, selection };

    return request;
  };

  const paramsForAddTagInside = () => {
    if (!writer || !ctx.element) return;

    const xpath = writer.utilities.getElementXPath(ctx.element);
    if (!xpath) return;

    const index = 0;
    const selectionXpath = writer.utilities.getElementXPath(ctx.element);

    const selection: PossibleNodesAtTargetSelection = {
      type: 'inside',
      xpath: selectionXpath ?? '',
    };
    const request: PossibleNodesAtTarget = { xpath, index, selection };

    return request;
  };

  const getTagsFor = async (params: PossibleNodesAtTarget) => {
    const tags = await getPossibleNodesAt(params);
    if (!tags) return [];
    return tags;
  };

  const getTagItems = (tags: NodeDetail[], action: Action) => {
    if (!writer) return;

    const menu = tags.map(({ name, fullName, invalid }) => {
      const item: ItemProps = {
        fullName,
        name,
        id: uuidv4(),
        onClick: () => {
          if (!writer.editor) return;

          if (ctx.tagId === undefined) return log.warn('No Tag selected');
          writer.editor.currentBookmark = writer.editor?.selection.getBookmark(1);

          if (action === 'change') {
            writer.tagger.changeTagDialog(name, ctx.tagId);
            return;
          }

          //@ts-ignore
          writer.editor.currentBookmark.tagId = ctx.tagId;
          writer.tagger.addTagDialog({
            tagName: name,
            tagFullname: fullName,
            action,
            parentTagId: ctx.tagId,
          });
        },
        invalid,
        type: 'tag',
      };
      return item;
    });

    return menu;
  };

  const getItems = async () => {
    if (ctx.isHeader) {
      const items: ItemProps[] = [
        {
          id: uuidv4(),
          type: 'action',
          name: t('Edit Header'),
          icon: 'edit',
          onClick: () => {
            const header = writer.editor
              ?.getBody()
              .querySelector(`[_tag="${writer.schemaManager.getHeader()}"]`);

            if (!header) return;

            const content = writer.converter.buildXMLString(header);

            openDialog({
              type: 'editSource',
              props: { content, type: 'header' },
            });
          },
        },
      ];
      return items;
    }

    if (ctx.isRoot) {
      const items: ItemProps[] = [
        {
          id: uuidv4(),
          name: t('leafwriter:commons.edit'),
          type: 'action',
          onClick: () => ctx.tagId && writer.tagger.editTagDialog(ctx.tagId),
        },
      ];
      return items;
    }

    if (ctx.eventSource === 'ribbon') {
      const params = paramsForAddTag();
      if (!params) return [];
      const tags = await getTagsFor(params);
      const items = getTagItems(tags, 'add');
      return items;
    }

    if (isAnnotator) {
      const items = getEntitiesOptions();
      return items;
    }

    if (!ctx.tagId) return [];

    const items: ItemProps[] = [];

    if (ctx.isMultiple) {
      items.push({
        type: 'collection',
        name: t('Add Tag Around'),
        icon: 'add',
        getChildren: async () => {
          const params = paramsForAddTagAround();
          if (!params) return [];
          const tags = await getTagsFor(params);
          const items = getTagItems(tags, 'around');
          return items ? items : [];
        },
      });

      items.push({ type: 'divider', name: 'divider' });

      if (Array.isArray(ctx.tagId)) {
        items.push({
          type: 'action',
          name: t('Merge Tags'),
          icon: 'merge',
          disabled: !ctx.allowsMerge,
          onClick: () => {
            if (!Array.isArray(ctx.tagId)) return;
            writer.tagger.mergeTags(ctx.tagId);
          },
        });
      }

      return items;
    }

    if (ctx.useSelection && ctx.allowsTagAround) {
      items.push({
        type: 'collection',
        name: t('Add Tag'),
        icon: 'add',
        getChildren: async () => {
          const params = paramsForAddTag();
          if (!params) return [];
          const tags = await getTagsFor(params);
          const items = getTagItems(tags, 'add');
          return items ? items : [];
        },
      });

      if (writer.schemaManager.isSchemaCustom() === false) {
        items.push({
          type: 'collection',
          name: t('Add Entity Annotation'),
          icon: 'add',
          searchable: false,
          children: getEntitiesOptions(),
        });
      }

      items.push({ type: 'divider', name: 'divider' });
    }

    if (!ctx.useSelection) {
      items.push({
        type: 'collection',
        name: t('Add Tag Before'),
        icon: 'add',
        getChildren: async () => {
          const params = paramsForAddTagBefore();
          if (!params) return [];
          const tags = await getTagsFor(params);
          const items = getTagItems(tags, 'before');
          return items ? items : [];
        },
      });

      items.push({
        type: 'collection',
        name: t('Add Tag After'),
        icon: 'add',
        getChildren: async () => {
          const params = paramsForAddTagAfter();
          if (!params) return [];
          const tags = await getTagsFor(params);
          const items = getTagItems(tags, 'after');
          return items ? items : [];
        },
      });

      items.push({
        type: 'collection',
        name: t('Add Tag Around'),
        icon: 'add',
        getChildren: async () => {
          const params = paramsForAddTagAround();
          if (!params) return [];
          const tags = await getTagsFor(params);
          const items = getTagItems(tags, 'around');

          return items ? items : [];
        },
      });

      if (ctx.nodeType !== 'text') {
        items.push({
          type: 'collection',
          name: t('Add Tag Inside'),
          icon: 'add',
          getChildren: async () => {
            const params = paramsForAddTagInside();
            if (!params) return [];
            const tags = await getTagsFor(params);
            const items = getTagItems(tags, 'inside');
            return items ? items : [];
          },
        });
      }

      items.push({ type: 'divider', name: 'divider' });
    }

    if (ctx.nodeType !== 'text') {
      items.push({
        type: 'action',
        name: ctx.isEntity ? t('Edit Entity Annotation') : t('Edit Tag'),
        icon: 'edit',
        onClick: () => ctx.tagId && writer.tagger.editTagDialog(ctx.tagId),
      });
    }

    if (!ctx.isEntity && ctx.element && ctx.nodeType !== 'text') {
      const tagName = ctx.element.getAttribute('_tag');
      if (tagName && writer.schemaManager.isTagEntity(tagName)) {
        items.push({
          type: 'action',
          name: t('Convert to Entity Annotation'),
          icon: 'edit',
          onClick: () => {
            if (ctx.element) {
              return writer.schemaManager.mapper.convertTagToEntity(ctx.element, true);
            }
          },
        });
      }
    }

    if (
      (!ctx.useSelection && ctx.nodeType !== 'text') ||
      (ctx.useSelection && !ctx.hasContentSelection)
    ) {
      items.push({
        type: 'collection',
        name: t('Change Tag'),
        icon: 'edit',
        getChildren: async () => {
          const params = paramsForChangeTag();
          if (!params) return [];
          const tags = await getTagsFor(params);
          const items = getTagItems(tags, 'change');
          return items ? items : [];
        },
      });
    }

    if (ctx.nodeType === 'text') {
      items.push({
        type: 'action',
        name: t('Copy Content'),
        icon: 'copy',
        onClick: async () => {
          if (!ctx.xpath || !writer.editor) return;

          const node = writer.utilities.evaluateXPath(writer.editor.getBody(), ctx.xpath);
          if (node === null) return;

          const content = typeof node === 'object' ? node.textContent : node.toString();
          if (!content || content === '') return;

          //@ts-ignore
          const permission = await navigator.permissions.query({ name: 'clipboard-write' });
          if (permission.state == 'granted' || permission.state == 'prompt') {
            await navigator.clipboard.writeText(content);
          }
        },
      });
    } else {
      items.push({
        type: 'action',
        name: ctx.isEntity ? t('Copy Entity') : t('Copy Tag and Contents'),
        icon: 'copy',
        onClick: () => ctx.tagId && writer.tagger.copyTag(ctx.tagId),
      });
    }

    if (ctx.nodeType === 'text') {
      items.push({
        type: 'action',
        name: t('Paste Content'),
        icon: 'paste',
        onClick: async () => {
          if (!ctx.xpath || !writer.editor) return;

          const node = writer.utilities.evaluateXPath(writer.editor.getBody(), ctx.xpath);
          if (node === null || typeof node !== 'object') return;

          // @ts-ignore
          const permission = await navigator.permissions.query({ name: 'clipboard-read' });
          if (permission.state == 'granted' || permission.state == 'prompt') {
            const content = await navigator.clipboard.readText();
            node.textContent = content;
          }
        },
      });
    } else {
      if (writer.editor?.copiedElement?.element !== undefined) {
        items.push({
          type: 'action',
          name: t('Paste Tag'),
          icon: 'paste',
          onClick: () => writer.tagger.pasteTag(),
        });
      } else if (writer.editor?.copiedEntity !== undefined) {
        items.push({
          type: 'action',
          name: t('Paste Entity'),
          icon: 'paste',
          onClick: () => writer.tagger.pasteEntity(),
        });
      }
    }

    if (ctx.useSelection) {
      items.push({
        type: 'action',
        name: t('Split Tag'),
        icon: 'split',
        onClick: () => writer.tagger.splitTag(),
      });
    }

    items.push({ type: 'divider', name: 'divider' });

    if (ctx.nodeType === 'text') {
      items.push({
        type: 'action',
        name: t('Remove Content'),
        icon: 'remove',
        onClick: () => {
          if (!ctx.xpath) return;
          writer.tagger.removeNodeTextContent(ctx.xpath);
        },
      });
      items.push({
        type: 'action',
        name: t('Remove Node'),
        icon: 'remove',
        onClick: () => {
          if (!ctx.xpath) return;
          writer.tagger.removeNodeText(ctx.xpath);
        },
      });
    } else {
      if (ctx.isEntity) {
        items.push({
          type: 'action',
          name: t('Remove Entity'),
          icon: 'remove',
          onClick: () => writer.tagger.removeEntity(ctx.tagId),
        });
      }

      items.push({
        type: 'action',
        name: t('Remove Tag'),
        icon: 'remove',
        onClick: () => ctx.tagId && writer.tagger.removeStructureTag(ctx.tagId, false),
      });

      items.push({
        type: 'action',
        name: t('Remove Content Only'),
        icon: 'remove',
        onClick: () => ctx.tagId && writer.tagger.removeStructureTagContents(ctx.tagId),
      });

      items.push({
        type: 'action',
        name: t('Remove All'),
        icon: 'remove',
        onClick: () => ctx.tagId && writer.tagger.removeStructureTag(ctx.tagId, true),
      });
    }

    if (ctx.eventSource === 'markupPanel') {
      //? Not until we develp better support for textNodes
      // items.push({ type: 'divider', name: 'divider' });
      // items.push({
      //   type: 'action',
      //   name: t('Show Text Nodes'),
      //   icon: markupPanel.showTextNodes ? 'checkIcon' : undefined,
      //   onClick: () => showTextNodes(),
      // });
    }

    return items;
  };

  return {
    getItems,
  };
};
