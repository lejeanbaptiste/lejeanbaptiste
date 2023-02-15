//@ts-nocheck
import $ from 'jquery';
import 'tinymce/icons/default';
import 'tinymce/plugins/paste';
import 'tinymce/themes/silver';
import tinymce, { type TinyMCE } from 'tinymce/tinymce';
import type { LeafWriterEditor } from '../../types';
import { log } from '../../utilities';
import './plugins/prevent_delete';
//TODO: Reassess plugins on tinymce 5.0
// import './tinymce_plugins/cwrc_path';
import fscreen from 'fscreen';
import Writer from '../Writer';
import './plugins/treepaste';

declare global {
  interface Window {
    tinymce: TinyMCE;
  }
}

window.tinymce = tinymce;

interface TinymceWrapperConfig {
  writer: Writer;
  editorId: string;
  layoutContainerId: string;
}

export const tinymceWrapperInit = function ({
  writer,
  editorId,
  layoutContainerId,
}: TinymceWrapperConfig) {
  tinymce.baseURL = `${writer.baseUrl}/js`;

  const toolbar = document.querySelector('#editor-toolbar');
  const toolbarHeight = toolbar.getBoundingClientRect().height;

  tinymce.init({
    selector: `#${editorId}`,
    ui_container: `#${layoutContainerId}`,
    skin_url: window.matchMedia('(prefers-color-scheme: dark)').matches
      ? `${writer.baseUrl}/css/tinymce/skins/ui/oxide-dark`
      : `${writer.baseUrl}/css/tinymce/skins/ui/oxide`,

    height: `calc(100% - ${toolbarHeight}px)`,
    width: '100%',
    content_css: window.matchMedia('(prefers-color-scheme: dark)').matches
      ? [
          `${writer.baseUrl}/css/tinymce/skins/content/dark/content.min.css`,
          `${writer.baseUrl}/css/editor.css`,
        ]
      : [
          `${writer.baseUrl}/css/tinymce/skins/content/writer/content.min.css`,
          `${writer.baseUrl}/css/editor.css`,
        ],

    doctype:
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    element_format: 'xhtml',

    forced_root_block: writer.schemaManager.getBlockTag(),
    keep_styles: false, // false, otherwise tinymce interprets our spans as style elements

    paste_postprocess: (plugin: any, args: any) => {
      writer.tagger.processNewContent(args.node);
      setTimeout(() => {
        // need to fire contentPasted here, after the content is actually within the document
        writer.event('contentPasted').publish();
      }, 0);
    },

    valid_elements: '*[*]', // allow everything

    // ? TRY TO IMPLEMENT PLUGIN SCHEMA TAG AS A WRAPPER FOR MENUITEM
    // ? PERHAPS IT IS BETTER TO HAVE THE RIBBON OUTSIDE OF TINYMCE (USING REACT)

    //TODO: Reassess plugins on tinymce 5.0
    plugins: [
      // 'cwrcpath',  //!This was broken before the upgrade
      'preventdelete', //TODO: need to be tested
      'paste', //TODO: need to be tested,
    ],

    toolbar1: '',

    menubar: false,
    elementpath: true,
    statusbar: false,
    branding: false,

    // disables style keyboard shortcuts
    formats: {
      //@ts-ignore
      bold: {},
      //@ts-ignore
      italic: {},
      //@ts-ignore
      underline: {},
    },

    setup: (editor: LeafWriterEditor) => {
      // link the writer and editor
      writer.editor = editor;
      editor.writer = writer;

      // custom properties added to the editor
      editor.currentBookmark = undefined; // for storing a bookmark used when adding a tag
      editor.currentNode = undefined; // the node that the cursor is currently in
      editor.copiedElement = { selectionType: undefined, element: undefined }; // the element that was copied (when first selected through the structure tree)
      editor.copiedEntity = undefined; // the entity element that was copied
      editor.lastKeyPress = undefined; // the last key the user pressed

      editor.on('init', (event) => {
        if (writer.isReadOnly === true) {
          writer.layoutManager.hideToolbar();
          editor.setMode('readonly');
        }

        // modify isBlock method to check _tag attributes
        editor.dom.isBlock = (node) => {
          if (!node) return false;

          // If it's a node then check the type and use the nodeName
          if (typeof node !== 'string') {
            if (node.nodeType === 1) {
              const element = node as Element;
              const tag = element.getAttribute('_tag') || element.nodeName;
              return !!editor.schema.getBlockElements()[tag];
            }
          }

          const node_string = node as string;
          return !!editor.schema.getBlockElements()[node_string];
        };

        writer.overmindActions.editor.applyInitialSettings();

        const body = editor.getBody();

        // highlight tracking
        body.addEventListener('keydown', onKeyDownHandler);
        body.addEventListener('keyup', onKeyUpHandler);

        // attach mouseUp to doc because body doesn't always extend to full height of editor panel
        if (editor.iframeElement?.contentDocument) {
          editor.iframeElement.contentDocument.addEventListener('mouseup', onMouseUpHandler);
        }

        writer.event('tinymceInitialized').publish(writer);

        editor.on('Change', onChangeHandler);
        editor.on('Undo', onUndoHandler);
        editor.on('Redo', onRedoHandler);
        editor.on('BeforeAddUndo', () => {
          /*log.info('before add undo'); */
        });
        editor.on('NodeChange', onNodeChangeHandler);
        editor.on('copy', onCopyHandler);

        editor.on('contextmenu', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();

          if (writer.isReadOnly) return;

          // const editorPosition = writer.utilities.getOffsetPosition(
          //   editor.getContentAreaContainer()
          // );

          const posX = event.screenX;
          let posY = event.screenY - 39;
          if (!fscreen.fullscreenElement) posY = posY - 78;

          writer.overmindActions.ui.showContextMenu({
            show: true,
            position: { posX, posY },
            useSelection: true,
          });
        });
      });
    },
  });

  // writer listeners

  writer.event('contentChanged').subscribe(() => {
    /* log.info('contentChanged'); */
  });

  writer.event('documentLoaded').subscribe(() => {
    if (!writer.editor) return;
    const {overmindState, overmindActions} = writer;
   
    writer.editor.undoManager.clear();
    writer.editor.isNotDirty = true;
    
    if (!overmindState.document.touched) {
      overmindActions.document.setDocumentTouched(true);
      overmindActions.editor.setContentHasChanged(false);
    }

    // need to explicitly set focus
    // otherwise writer.editor.selection.getBookmark doesn't work until the user clicks inside the editor
    writer.editor.getBody().focus();
  });

  writer.event('documentSaved').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(false);
    return (writer.editor.isNotDirty = true);
  });
  writer.event('entityAdded').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });
  writer.event('entityRemoved').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });
  writer.event('entityEdited').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });

  // tinymce handlers

  const fireNodeChange = (element: Element) => {
    // fire the onNodeChange event
    const parents: Node[] = [];
    writer.editor?.dom.getParent(element, (node: Node) => {
      if (node.nodeName === 'BODY') return true;
      parents.push(node);
    });
    writer.editor?.fire('NodeChange', { element, parents });
  };

  const onMouseUpHandler = (event: MouseEvent) => {
    doHighlightCheck(event);
    // doHighlightCheck(writer.editor, event);
    writer.event('selectionChanged').publish();
  };

  const onUndoHandler = (event: any) => {
    log.info('undoHandler', event);
    writer.event('contentChanged').publish();
  };

  const onRedoHandler = (event: any) => {
    log.info('redoHandler', event);
    writer.event('contentChanged').publish();
  };

  const onKeyDownHandler = (event: KeyboardEvent) => {
    if (!writer.editor) return;

    writer.editor.lastKeyPress = event.code; // store the last key press

    if ((tinymce.isMac ? event.metaKey : event.ctrlKey)) return;

    //allow select all
    if ((tinymce.isMac ? event.metaKey : event.ctrlKey) && event.code === 'KeyA') {
      event.preventDefault();
      return;
    }

    writer.overmindActions.editor.setContentHasChanged(true);
    writer.editor.isNotDirty = false;

    writer.event('writerKeydown').publish(event);
  };

  const onKeyUpHandler = (event: KeyboardEvent) => {
    // nav keys and backspace check
    switch (event.code) {
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'Backspace': {
        doHighlightCheck(event);
        // doHighlightCheck(writer.editor, event);
      }
    }

    // update current entity
    const entityId = writer.entitiesManager.getCurrentEntity();
    if (entityId !== null) {
      const content = $('.entityHighlight', writer.editor?.getBody()).text();
      const entity = writer.entitiesManager.getEntity(entityId);
      if (entity.isNote()) {
        entity.setNoteContent($(`#${entityId}`, writer.editor?.getBody()).html());
      }
      entity.setContent(content);
      writer.event('entityEdited').publish(entityId);
    }

    if (writer.editor?.currentNode) {
      // check if the node still exists in the document
      if (writer.editor?.currentNode.parentNode === null) {
        let rng = writer.editor?.selection.getRng(true);
        const parent = rng.commonAncestorContainer.parentNode;
        // trying to type inside a bogus node?
        // (this can happen on webkit when typing "over" a selected structure tag)
        if (parent.getAttribute('data-mce-bogus') !== null) {
          const $parent = $(parent);
          let collapseToStart = true;

          let newCurrentNode = $parent.nextAll('[_tag]')[0];
          if (newCurrentNode === null) {
            newCurrentNode = $parent.parent().nextAll('[_tag]')[0];
            if (newCurrentNode === null) {
              collapseToStart = false;
              newCurrentNode = $parent.prevAll('[_tag]')[0];
            }
          }

          if (newCurrentNode !== null) {
            rng.selectNodeContents(newCurrentNode);
            rng.collapse(collapseToStart);
            writer.editor?.selection.setRng(rng);

            window.setTimeout(() => {
              fireNodeChange(newCurrentNode);
            }, 0);
          }
        }
      }

      // check if text is allowed in this node
      if (writer.editor?.currentNode.getAttribute('_textallowed') === 'false') {
        if (event.key === 'Meta' || event.ctrlKey) {
          // if the Meta // command // crtl key -> do nothing
        } else if (tinymce.isMac ? event.metaKey : event.ctrlKey) {
          // don't show message if we got here through undo/redo
          const node = $('[_textallowed="true"]', writer.editor?.getBody()).first();
          let rng = writer.editor?.selection.getRng(true);
          rng.selectNodeContents(node[0]);
          rng.collapse(true);
          writer.editor?.selection.setRng(rng);
        } else {
          if (writer.editor?.currentNode.getAttribute('_entity') !== 'true') {
            // exception for entities since the entity parent tag can actually encapsulate several tags
            const currentTag = writer.editor?.currentNode.getAttribute('_tag');
            writer.dialogManager.show('message', {
              title: 'No Text Allowed',
              msg: `Text is not allowed in the current tag: ${currentTag}.`,
              type: 'error',
            });
          }

          //? commented out, seems a bit drastic
          // remove all text
          // $(writer.editor?.currentNode).contents().filter(function() {
          //     return this.nodeType === 3;
          // }).remove();
        }
      }
    }

    // enter key
    if (event.code === 'Enter') {
      const node = writer.editor?.currentNode; // the new element inserted by tinymce
      if (!node) {
        log.warn('tinymceWrapper: user pressed enter but no new node found');
      } else {
        if (event.shiftKey) {
          // TODO replace linebreaks inserted on shift+enter with schema specific linebreak tag
          // for now just undo the linebreak in the text
          node.normalize();
        } else {
          // empty tag check
          // insert zero-width non-breaking space so empty tag takes up space
          const $node = $(node);
          if ($node.text() === '') $node.text('\uFEFF');
          writer.tagger.processNewContent(node);

          writer.editor?.undoManager.add();
          writer.event('contentChanged').publish();
        }
      }
    }

    writer.event('writerKeyup').publish(event);
  }

  const onChangeHandler = (event: any) => {
    $('br', writer.editor?.getBody()).remove(); // remove br tags that get added by shift+enter
    writer.event('contentChanged').publish();
  };

  const onNodeChangeHandler = (event: any) => {
    if (!writer.editor) return;

    let element = event.element;
    if (element.nodeType !== 1) {
      writer.editor.currentNode = writer.utilities.getRootTag()[0];
    } else {
      if (element.getAttribute('id') === 'mcepastebin') return;

      if (
        element.getAttribute('_tag') === null &&
        element.classList.contains('entityHighlight') === false
      ) {
        // TODO review is this is still necessary
        if (element.getAttribute('data-mce-bogus') !== null) {
          // artifact from utilities.selectElementById
          let sibling: any;
          // let rng = writer.editor.selection.getRng(true);
          let rng = writer.editor.selection.getRng();
          if (rng.collapsed) {
            // the user's trying to type in a bogus tag
            // find the closest valid tag and correct the cursor location
            let backwardDirection = true;
            if (
              writer.editor.lastKeyPress === 'Home' ||
              writer.editor.lastKeyPress === 'ArrowLeft' ||
              writer.editor.lastKeyPress === 'ArrowUp'
            ) {
              sibling = $(element).prevAll('[_tag]')[0];
              backwardDirection = false;
            } else {
              sibling = $(element).nextAll('[_tag]')[0] ?? $(element).parent().nextAll('[_tag]')[0];
            }
            if (sibling !== null) {
              rng.selectNodeContents(sibling);
              rng.collapse(backwardDirection);
              writer.editor.selection.setRng(rng);
            }
          } else {
            // the structure is selected
            sibling = $(element).next('[_tag]')[0];
          }

          element = sibling !== null ? sibling : element.parentNode;
        } else if (element === writer.editor.getBody()) {
          return;
        } else {
          element = element.parentNode;
        }

        // use setTimeout to add to the end of the onNodeChange stack
        window.setTimeout(() => {
          fireNodeChange(element);
        }, 0);
      } else {
        writer.editor.currentNode = element;
      }
    }

    writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);

    writer.event('nodeChanged').publish(writer.editor.currentNode);
  };

  const onCopyHandler = (event: any) => {
    if (!writer.editor) return;

    if (writer.editor.copiedElement?.element) {
      $(writer.editor.copiedElement.element).remove();
      writer.editor.copiedElement.element = undefined;
    }
    writer.event('contentCopied').publish();
  };

  const doHighlightCheck = (event: any, _ev?: any) => {
    if (!writer.editor) return;
    // let range = writer.editor?.selection.getRng(true);
    let range = writer.editor.selection.getRng();

    // check if inside boundary tag
    const parent = range.commonAncestorContainer;
    if (parent.nodeType === Node.ELEMENT_NODE && parent.hasAttribute('_entity')) {
      writer.entitiesManager.highlightEntity(); // remove highlight
      if (
        (writer.editor?.dom.hasClass(parent, 'start') && event.code === 'ArrowLeft') ||
        (writer.editor?.dom.hasClass(parent, 'end') && event.code !== 'ArrowRight')
      ) {
        const prevNode = writer.utilities.getPreviousTextNode(parent);
        if (prevNode) {
          range.setStart(prevNode, prevNode.length);
          range.setEnd(prevNode, prevNode.length);
        }
      } else {
        const nextNode = writer.utilities.getNextTextNode(parent);
        if (nextNode) {
          range.setStart(nextNode, 0);
          range.setEnd(nextNode, 0);
        }
      }
      writer.editor?.selection.setRng(range);
      // range = writer.editor?.selection.getRng(true);
      range = writer.editor.selection.getRng();
    }

    const entity = $(range.startContainer).parents('[_entity]')[0];

    if (!entity) {
      writer.entitiesManager.highlightEntity();
      // const parentNode = $(writer.editor?.selection.getNode());
      // if (parentNode.attr('_tag')) id = parentNode.attr('id');
      return;
    }

    const id = entity.getAttribute('name');
    if (!id) return;
    if (id === writer.entitiesManager.getCurrentEntity()) return;

    writer.entitiesManager.highlightEntity(id, writer.editor?.selection.getBookmark());
  };
};
