import $ from 'jquery';
import 'tinymce/icons/default';
import 'tinymce/plugins/paste';
import 'tinymce/themes/silver';
import tinymce, { type TinyMCE } from 'tinymce/tinymce';
import type { LeafWriterEditor } from '../../types';
import { dispatchDesktopOpenFind } from '../../sourceEditor/findInSourceEditor';
import { isElement, log } from '../../utilities';
import './plugins/prevent_delete';
//TODO: Reassess plugins on tinymce 5.0
// import './tinymce_plugins/cwrc_path';
import fscreen from 'fscreen';
import Writer from '../Writer';
import { normalizePastedParagraphs, fixNestedPastedParagraphs, removeEmptyParagraphs } from './normalizePastedParagraphs';
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
  const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;

  const visualBodyStyle =
    'body { margin: 8px !important; max-width: none !important; width: auto !important; }';

  void tinymce.init({
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
    content_style: visualBodyStyle,
    doctype: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">`,
    element_format: 'xhtml',

    forced_root_block: writer.schemaManager.getBlockTag(),
    keep_styles: false, // false, otherwise tinymce interprets our spans as style elements

    paste_postprocess: (plugin: any, args: any) => {
      normalizePastedParagraphs(writer, args.node);
      writer.tagger.processNewContent(args.node);
      setTimeout(() => {
        if (writer.editor) {
          const body = writer.editor.getBody();
          fixNestedPastedParagraphs(body);
          removeEmptyParagraphs(body, writer.schemaManager.getBlockTag());
        }
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
      bold: [],
      italic: [],
      underline: [],
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

      editor.on('init', () => {
        if (writer.isReadOnly === true) {
          editor.mode.set('readonly');
        }

        // Undo levels are captured via getContent({ format: 'raw' }), which bypasses
        // the serializer entirely. BeforeAddUndo is the only reliable intercept point.
        // Strip our transient classes from the level content, then cancel the level
        // entirely if the stripped content is identical to the previous level.
        const stripLWClasses = (s: string) => s
          .replace(/\s*\btag-cursor-active\b/g, '')
          .replace(/\s*\btag-at-boundary\b/g, '');

        editor.on('BeforeAddUndo', (e: any) => {
          if (!e.level?.content) return;
          e.level.content = stripLWClasses(e.level.content);
          const lastClean = e.lastLevel?.content ? stripLWClasses(e.lastLevel.content) : null;
          if (lastClean !== null && e.level.content === lastClean) {
            e.preventDefault();
          }
        });

        // modify isBlock method to check _tag attributes
        editor.dom.isBlock = (node) => {
          if (!node) return false;

          // If it's a node then check the type and use the nodeName
          if (typeof node !== 'string') {
            if (isElement(node)) {
              const element = node;
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
        body.addEventListener('keydown', onKeyDownHandler, true);
        body.addEventListener('keyup', onKeyUpHandler);

        // attach mouseUp to doc because body doesn't always extend to full height of editor panel
        if (editor.iframeElement?.contentDocument) {
          const iframeDoc = editor.iframeElement.contentDocument;
          iframeDoc.addEventListener('mouseup', onMouseUpHandler);
          iframeDoc.addEventListener(
            'keydown',
            (event: KeyboardEvent) => {
              if ((event.metaKey || event.ctrlKey) && event.code === 'KeyF') {
                event.preventDefault();
                dispatchDesktopOpenFind();
              }
            },
            true,
          );
        }

        writer.event('tinymceInitialized').publish(writer);

        editor.on('Change', onChangeHandler);
        editor.on('Undo', onUndoHandler);
        editor.on('Redo', onRedoHandler);
        editor.on('BeforeAddUndo', () => {
          /*log.info('before add undo'); */
        });
        // editor.on();
        editor.on('NodeChange', (event) => {
          onNodeChangeHandler(event.element);
        });
        editor.on('copy', onCopyHandler);

        editor.on('contextmenu', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();

          if (writer.isReadOnly) return;

          const offsetX = fscreen.fullscreenElement ? 0 : 0;
          const offsetY = fscreen.fullscreenElement ? 0 : -90;

          const posX = event.screenX - (event.view?.screenLeft ?? 0) + offsetX;
          const posY = event.screenY - (event.view?.screenTop ?? 0) + offsetY;

          writer.overmindActions.ui.showContextMenu({
            eventSource: 'editor',
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
    const { overmindState, overmindActions } = writer;

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
  writer.event('tagAdded').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });
  writer.event('tagEdited').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });
  writer.event('tagRemoved').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });
  writer.event('tagContentsRemoved').subscribe(() => {
    if (!writer.editor) return;
    writer.overmindActions.editor.setContentHasChanged(true);
    return (writer.editor.isNotDirty = false);
  });
  writer.event('contentPasted').subscribe(() => {
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

  // === Tag boundary visualization ===
  // Class mutations are wrapped in undoManager.ignore() so they never enter the undo stack.

  let currentActiveElement: Element | null = null;
  let currentBoundaryElement: Element | null = null;
  // true when cursor is outside the element (in parent/sibling), false when at end-of-text inside
  let currentBoundaryIsExternal = false;
  // true when user has pressed through the first stop — same DOM position, tag-removal behavior
  let currentVirtualExternal = false;

  // Cursor position saved at keydown — used in keyup to detect whether the key actually moved
  // the cursor or whether TinyMCE bounced it back to the same place.
  let _keydownContainer: Node | null = null;
  let _keydownOffset = -1;
  // Whether currentVirtualExternal was set when keydown fired — needed in keyup to distinguish
  // "enter virtual external" from "advance past tag".
  let _keydownBoundaryWasVirtualExternal = false;

  const applyBoundaryClasses = (activeEl: Element | null, boundaryEl: Element | null, externalBoundary = false) => {
    if (currentActiveElement) {
      currentActiveElement.classList.remove('tag-cursor-active', 'tag-at-boundary', 'tag-external-active');
    }
    // Clear virtual external when boundary element changes (cursor moved away from the tag)
    if (boundaryEl !== currentBoundaryElement) currentVirtualExternal = false;
    currentActiveElement = activeEl;
    currentBoundaryElement = boundaryEl;
    currentBoundaryIsExternal = externalBoundary;
    if (activeEl) activeEl.classList.add('tag-cursor-active');
    if (boundaryEl) {
      boundaryEl.classList.add('tag-at-boundary');
      if (currentVirtualExternal) boundaryEl.classList.add('tag-external-active');
    }
  };

  const clearTagBoundaryState = () => applyBoundaryClasses(null, null);

  // Manages the second cursor stop — same DOM position but tag-removal behavior.
  const setVirtualExternal = (active: boolean) => {
    currentVirtualExternal = active;
    if (currentBoundaryElement) {
      if (active) currentBoundaryElement.classList.add('tag-external-active');
      else currentBoundaryElement.classList.remove('tag-external-active');
    }
  };

  // Pure structural tag (no entity marker) — used for sibling detection.
  const isTagEl = (n: Node | null): n is Element =>
    isElement(n) &&
    (n as Element).hasAttribute('_tag') &&
    !(n as Element).hasAttribute('_entity') &&
    (n as Element).getAttribute('_tag') !== 'pb';

  // Also matches combined _entity+_tag spans (xml2cwrc stamps _entity onto existing structural tags).
  // Used when the cursor is INSIDE the element (parent checks), not for sibling detection.
  const isTagOrCombinedEl = (n: Node | null): n is Element =>
    isElement(n) &&
    (n as Element).hasAttribute('_tag') &&
    (n as Element).getAttribute('_tag') !== 'pb';

  const updateTagBoundaryState = () => {
    if (!writer.editor) return;

    const rng = writer.editor.selection.getRng();
    if (!rng.collapsed) {
      applyBoundaryClasses(null, null);
      return;
    }

    const container = rng.startContainer;
    const offset = rng.startOffset;

    let tagEl: Element | null = null;
    let atBoundary = false;

    // doHighlightCheck() moves the cursor out of entity wrappers, so "end of persName"
    // lands at offset=0 in the next text node with the entity wrapper as previousSibling.
    // This helper looks through an entity wrapper to find the [_tag] span inside it.
    const tagElThroughEntity = (n: Node | null): Element | null => {
      if (!n || !isElement(n)) return null;
      const el = n as Element;
      const tag = el.getAttribute('_tag');
      // Plain structural tag (no entity marker)
      if (tag && tag !== 'pb' && !el.hasAttribute('_entity')) return el;
      if (!el.hasAttribute('_entity')) return null;
      // Combined entity+tag span: xml2cwrc stamps _entity onto the existing structural tag in-place
      if (tag && tag !== 'pb') return el;
      // Pure entity wrapper (has _entity, no _tag): look for a structural child
      const inner = el.querySelector('[_tag]:not([_entity])') as Element | null;
      return inner && inner.getAttribute('_tag') !== 'pb' ? inner : null;
    };

    // externalBoundary = cursor is in parent/sibling rather than inside the element's own text.
    // Only external boundaries trigger backspace-to-remove; internal ones allow normal text editing.
    let externalBoundary = false;

    if (container.nodeType === Node.TEXT_NODE) {
      const textLen = (container as Text).length;
      const parent = container.parentElement;

      if (offset === 0) {
        const prevSib = container.previousSibling;
        const via = tagElThroughEntity(prevSib);
        if (via) { tagEl = via; atBoundary = true; externalBoundary = true; }
        else if (isTagOrCombinedEl(parent)) { tagEl = parent; atBoundary = true; }
      } else if (offset >= textLen) {
        const nextSib = container.nextSibling;
        const via = tagElThroughEntity(nextSib);
        if (via) { tagEl = via; atBoundary = true; externalBoundary = true; }
        else if (isTagOrCombinedEl(parent)) { tagEl = parent; atBoundary = true; }
      } else {
        if (isTagOrCombinedEl(parent)) tagEl = parent;
      }
    } else if (isElement(container)) {
      const el = container as Element;
      const childAfter = el.childNodes[offset] ?? null;
      const childBefore = el.childNodes[offset - 1] ?? null;

      const viaAfter = tagElThroughEntity(childAfter);
      const viaBefore = tagElThroughEntity(childBefore);

      if (viaAfter) { tagEl = viaAfter; atBoundary = true; externalBoundary = true; }
      else if (viaBefore) { tagEl = viaBefore; atBoundary = true; externalBoundary = true; }
      else if (isTagOrCombinedEl(el)) {
        tagEl = el;
        atBoundary = offset === 0 || offset >= el.childNodes.length;
      }
    }

    if (!tagEl) { applyBoundaryClasses(null, null); return; }

    applyBoundaryClasses(tagEl, atBoundary ? tagEl : null, externalBoundary);
  };

  // === End tag boundary visualization ===

  const onMouseUpHandler = (event: MouseEvent) => {
    if (!writer.editor) return;
    doHighlightCheck(event);
    updateTagBoundaryState();

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
    // if (writer.isReadOnly === true) return

    writer.editor.lastKeyPress = event.code; // store the last key press

    // Snapshot cursor position so keyup can detect whether the key actually moved the cursor.
    const _kd = writer.editor.selection.getRng();
    _keydownContainer = _kd.startContainer;
    _keydownOffset = _kd.startOffset;

    // === Tag boundary two-stop keyboard handling ===
    // First stop (tag-at-boundary): Backspace/Delete delete chars normally; arrow blocks at boundary.
    // Second stop (tag-external-active): Backspace/Delete remove the tag; arrow advances past it.
    if (
      currentBoundaryElement &&
      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
      writer.editor &&
      (event.code === 'ArrowRight' || event.code === 'ArrowLeft' ||
       event.code === 'Backspace' || event.code === 'Delete')
    ) {
      _keydownBoundaryWasVirtualExternal = currentVirtualExternal;
      if (currentVirtualExternal) setVirtualExternal(false);

      // Second stop: Backspace/Delete removes the tag.
      if (
        _keydownBoundaryWasVirtualExternal &&
        (event.code === 'Backspace' || event.code === 'Delete') &&
        writer.isReadOnly !== true
      ) {
        const id = currentBoundaryElement.getAttribute('id');
        if (id) {
          event.preventDefault();
          clearTagBoundaryState();
          writer.tagger.removeTag(id);
          return;
        }
      }

      const rng = writer.editor.selection.getRng();
      const c = rng.startContainer;
      const o = rng.startOffset;
      const textLen = c.nodeType === Node.TEXT_NODE ? (c as Text).length : 0;
      const isAtTextEnd = c.nodeType === Node.TEXT_NODE && o >= textLen;
      const isAtTextStart = o === 0;

      if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
        if (currentBoundaryIsExternal) {
          // DOM-external: first "toward-tag" press enters virtual external (second stop).
          // Second press (virtual external already set, now cleared above) allows movement.
          const towardTag =
            (isAtTextEnd && event.code === 'ArrowRight') ||
            (isAtTextStart && event.code === 'ArrowLeft');
          if (towardTag && !_keydownBoundaryWasVirtualExternal) {
            event.preventDefault();
            setVirtualExternal(true);
            return;
          }
        } else {
          // Internal boundary: first press at end/start → enter virtual external, prevent movement.
          // Second press (was virtual external, cleared above) → allow movement; keyup advances.
          if (isAtTextEnd && event.code === 'ArrowRight' && !_keydownBoundaryWasVirtualExternal) {
            event.preventDefault();
            setVirtualExternal(true);
            return;
          }
          if (isAtTextStart && event.code === 'ArrowLeft' && !_keydownBoundaryWasVirtualExternal) {
            event.preventDefault();
            setVirtualExternal(true);
            return;
          }
        }
      }

      // First stop: block Backspace/Delete from crossing the tag boundary.
      if (!_keydownBoundaryWasVirtualExternal) {
        if (isAtTextEnd && event.code === 'Delete') { event.preventDefault(); return; }
        if (isAtTextStart && event.code === 'Backspace') { event.preventDefault(); return; }
      }
    }
    // === End tag boundary handling ===

    if (tinymce.isMac ? event.metaKey : event.ctrlKey) return;

    //allow select all
    if ((tinymce.isMac ? event.metaKey : event.ctrlKey) && event.code === 'KeyA') {
      event.preventDefault();
      return;
    }

    if (writer.isReadOnly === true) return;

    const desktopTagging = window.__desktopTagging;
    const taggingHandled = Boolean(desktopTagging?.handleEditorKeyDown(event));
    if (taggingHandled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    writer.overmindActions.editor.setContentHasChanged(true);
    writer.editor.isNotDirty = false;

    writer.event('writerKeydown').publish(event);
  };

  const isTextEntryAttempt = (event: KeyboardEvent): boolean => {
    if (event.isComposing) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;

    // Printable character (letter, number, punctuation, space, etc.)
    if (event.key.length === 1) return true;

    return event.code === 'Enter' || event.code === 'NumpadEnter';
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
        updateTagBoundaryState();

        // Internal boundary: TinyMCE bounces ArrowRight/Left back into the entity element.
        // On first bounce → enter virtual external (second stop, strong bracket highlight).
        // On second bounce (was virtual external) → advance cursor past the tag.
        if (
          (event.code === 'ArrowRight' || event.code === 'ArrowLeft') &&
          currentBoundaryElement &&
          !currentBoundaryIsExternal &&
          !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
          writer.editor
        ) {
          const rng2 = writer.editor.selection.getRng();
          const c2 = rng2.startContainer;
          const o2 = rng2.startOffset;
          const isAtEnd2 =
            c2.nodeType === Node.TEXT_NODE
              ? o2 >= (c2 as Text).length
              : isElement(c2) && o2 >= c2.childNodes.length;
          const isAtStart2 = o2 === 0;
          const cursorMoved = c2 !== _keydownContainer || o2 !== _keydownOffset;

          if (!cursorMoved && event.code === 'ArrowRight' && isAtEnd2) {
            if (!_keydownBoundaryWasVirtualExternal) {
              // First stop → second stop
              setVirtualExternal(true);
            } else {
              // Second stop → advance past tag
              const startFrom = currentBoundaryElement.lastChild ?? currentBoundaryElement;
              const nextText = writer.utilities.getNextTextNode(startFrom);
              if (nextText) {
                const nr = writer.editor.getDoc().createRange();
                nr.setStart(nextText, 0);
                nr.setEnd(nextText, 0);
                writer.editor.selection.setRng(nr);
                updateTagBoundaryState();
              }
            }
          } else if (!cursorMoved && event.code === 'ArrowLeft' && isAtStart2) {
            if (!_keydownBoundaryWasVirtualExternal) {
              // First stop → second stop
              setVirtualExternal(true);
            } else {
              // Second stop → advance past tag
              const startFrom = currentBoundaryElement.firstChild ?? currentBoundaryElement;
              const prevText = writer.utilities.getPreviousTextNode(startFrom);
              if (prevText) {
                const nr = writer.editor.getDoc().createRange();
                nr.setStart(prevText, (prevText as Text).length);
                nr.setEnd(prevText, (prevText as Text).length);
                writer.editor.selection.setRng(nr);
                updateTagBoundaryState();
              }
            }
          }
        }
      }
    }

    if (writer.isReadOnly === true) return;

    // update current entity
    const entityId = writer.entitiesManager.getCurrentEntity();
    if (entityId !== null) {
      const content = $('.entityHighlight', writer.editor?.getBody()).text();
      const entity = writer.entitiesManager.getEntity(entityId);
      if (entity?.isNote()) {
        entity.setNoteContent($(`#${entityId}`, writer.editor?.getBody()).html());
      }
      entity?.setContent(content);
      writer.event('entityEdited').publish(entityId);
    }

    if (writer.editor?.currentNode) {
      // check if the node still exists in the document
      if (writer.editor?.currentNode.parentNode === null) {
        const rng = writer.editor?.selection.getRng();
        const parent = rng.commonAncestorContainer.parentNode;
        if (isElement(parent)) {
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

            if (newCurrentNode) {
              rng.selectNodeContents(newCurrentNode);
              rng.collapse(collapseToStart);
              writer.editor?.selection.setRng(rng);

              window.setTimeout(() => {
                if (newCurrentNode) fireNodeChange(newCurrentNode);
              }, 0);
            }
          }
        }
      }

      // check if text is allowed in this node
      const currentNode = writer.editor?.currentNode;
      if (isElement(currentNode)) {
        if (currentNode.getAttribute('_textallowed') === 'false') {
          if (event.key === 'Meta' || event.ctrlKey) {
            // if the Meta // command // crtl key -> do nothing
          } else if (tinymce.isMac ? event.metaKey : event.ctrlKey) {
            // don't show message if we got here through undo/redo
            const node = $('[_textallowed="true"]', writer.editor?.getBody()).first();
            const rng = writer.editor?.selection.getRng();
            if (node[0]) rng.selectNodeContents(node[0]);
            rng.collapse(true);
            writer.editor?.selection.setRng(rng);
          } else if (isTextEntryAttempt(event)) {
            if (currentNode.getAttribute('_entity') !== 'true') {
              // exception for entities since the entity parent tag can actually encapsulate several tags
              const currentTag = currentNode.getAttribute('_tag');
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
    }

    // enter key — legacy paragraph insert (web LEAF-Writer only; desktop uses tag popup)
    if (event.code === 'Enter' && !window.__desktopTagging) {
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
          if (typeof writer.editor?.undoManager.transact === 'function') {
            writer.editor.undoManager.transact(() => {
              if ($node.text() === '') $node.text('\uFEFF');
              if (isElement(node)) writer.tagger.processNewContent(node);
            });
          } else {
            if ($node.text() === '') $node.text('\uFEFF');
            if (isElement(node)) writer.tagger.processNewContent(node);
          }
          writer.event('contentChanged').publish();
        }
      }
    }

    writer.event('writerKeyup').publish(event);
  };

  const onChangeHandler = () => {
    if (!window.__desktopTagging) {
      $('br', writer.editor?.getBody()).remove(); // remove br tags that get added by shift+enter
    }
    writer.event('contentChanged').publish();
  };

  const onNodeChangeHandler = (element: Element) => {
    if (!writer.editor) return;
    if (!isElement(element)) {
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
          const rng = writer.editor.selection.getRng();
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
        } else if (isElement(element.parentNode)) {
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
    updateTagBoundaryState();
  };

  const onCopyHandler = (event: any) => {
    if (!writer.editor) return;

    if (writer.editor.copiedElement?.element) {
      $(writer.editor.copiedElement.element).remove();
      writer.editor.copiedElement.element = undefined;
    }
    writer.event('contentCopied').publish();
  };

  const doHighlightCheck = (event: any) => {
    if (!writer.editor) return;
    // let range = writer.editor?.selection.getRng(true);
    let range = writer.editor.selection.getRng();

    // check if inside boundary tag
    const parent = range.commonAncestorContainer;
    if (isElement(parent) && parent.hasAttribute('_entity')) {
      writer.entitiesManager.highlightEntity(); // remove highlight
      if (
        (writer.editor?.dom.hasClass(parent, 'start') && event.code === 'ArrowLeft') ||
        (writer.editor?.dom.hasClass(parent, 'end') && event.code !== 'ArrowRight')
      ) {
        const prevNode = writer.utilities.getPreviousTextNode(parent);
        if (prevNode) {
          //@ts-ignore
          range.setStart(prevNode, prevNode.length);
          //@ts-ignore
          range.setEnd(prevNode, prevNode.length);
        }
      } else {
        // When cursor is at or past the end of the entity element's own children, we need the
        // text node AFTER the entity in the DOM — not the first text node inside it.
        // getNextTextNode(parent) would depth-first-enter parent and find its own content first.
        const pastEnd = range.startOffset >= parent.childNodes.length;
        const startFrom = pastEnd && parent.lastChild ? parent.lastChild : parent;
        const nextNode = writer.utilities.getNextTextNode(startFrom);
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
