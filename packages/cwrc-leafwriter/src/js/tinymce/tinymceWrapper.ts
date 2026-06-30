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
        body.addEventListener('beforeinput', onBeforeInputHandler as EventListener, true);

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
  // The boundary element at keydown time — preserved in keyup even after updateTagBoundaryState
  // clears currentBoundaryElement (e.g. when TinyMCE bounces cursor to a non-boundary position).
  let _keydownBoundaryElement: Element | null = null;
  // Advance target decided in keydown but applied in keyup, after TinyMCE's own keyup handler
  // has already run (and possibly bounced cursor). Applied before updateTagBoundaryState.
  let _pendingAdvance: { node: Node; offset: number; isExit?: boolean; isSuppressBoundary?: boolean } | null = null;
  // When a deliberate entry advance lands inside an entity (L2R at offset 0, R2L at textLen),
  // record the exact position here. updateTagBoundaryState will suppress the atBoundary flag
  // while cursor stays at that position, preventing the boundary-stop machinery from re-engaging
  // immediately after entry (including via async NodeChange from setRng). Cleared automatically
  // the first time updateTagBoundaryState sees cursor at any other position.
  let _suppressedBoundaryPosition: { node: Node; offset: number } | null = null;

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
        else if (isTagOrCombinedEl(parent)) { tagEl = parent; atBoundary = true; /* internal start: stop ArrowLeft exit (symmetric with internal end) */ }
      } else if (offset >= textLen) {
        const nextSib = container.nextSibling;
        const via = tagElThroughEntity(nextSib);
        if (via) { tagEl = via; atBoundary = true; externalBoundary = true; }
        else if (isTagOrCombinedEl(parent)) { tagEl = parent; atBoundary = true; /* internal end: stop ArrowRight exit */ }
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

    // Suppress the boundary stop at the exact position where a deliberate entry advance landed
    // (L2R pos 3 at offset 0, R2L pos 3 at textLen). The flag self-clears when cursor moves away.
    if (_suppressedBoundaryPosition) {
      const r = writer.editor.selection.getRng();
      if (r.startContainer === _suppressedBoundaryPosition.node &&
          r.startOffset === _suppressedBoundaryPosition.offset) {
        atBoundary = false;
      } else {
        _suppressedBoundaryPosition = null;
      }
    }

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

    // === DEBUG: log arrow key state near tag boundaries ===
    if ((event.code === 'ArrowRight' || event.code === 'ArrowLeft') &&
        !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const sel = (writer.editor.getDoc().defaultView ?? window).getSelection();
      console.log(`[boundary KD] ${event.code}`, {
        anchorNode: sel?.anchorNode,
        anchorNodeType: sel?.anchorNode?.nodeType === 3 ? 'TEXT' : sel?.anchorNode?.nodeType === 1 ? 'ELEMENT' : sel?.anchorNode?.nodeType,
        anchorOffset: sel?.anchorOffset,
        anchorNodeValue: sel?.anchorNode?.nodeType === 3 ? JSON.stringify((sel.anchorNode as Text).data) : null,
        anchorNodeLen: sel?.anchorNode?.nodeType === 3 ? (sel.anchorNode as Text).length : null,
        parentEl: (sel?.anchorNode as any)?.parentElement?.tagName + '[' + (sel?.anchorNode as any)?.parentElement?.getAttribute('_tag') + ']',
        currentBoundaryElement: currentBoundaryElement?.getAttribute('id') ?? null,
        currentBoundaryIsExternal,
        currentVirtualExternal,
      });
    }
    // === END DEBUG ===

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
      _keydownBoundaryElement = currentBoundaryElement;
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

      // Whether the arrow is pointing "outward" from the current boundary position.
      // For both internal and DOM-external, this direction enters/exits the tag.
      const outwardArrow =
        (isAtTextEnd && event.code === 'ArrowRight') ||
        (isAtTextStart && event.code === 'ArrowLeft');

      if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
        if (outwardArrow) {
          if (_keydownBoundaryWasVirtualExternal) {
            // Second stop → advance cursor past/into the tag.
            // Target is computed here (before TinyMCE moves cursor) and applied in keyup,
            // after TinyMCE's entity-navigation keyup has already run.
            let advNode: Node | null = null;
            let advOffset = 0;
            let isExitAdvance = false;
            if (!currentBoundaryIsExternal) {
              // Internal boundary: advance PAST the tag into adjacent text.
              if (event.code === 'ArrowRight') {
                const n = writer.utilities.getNextTextNode(
                  currentBoundaryElement.lastChild ?? currentBoundaryElement
                );
                if (n) { advNode = n; advOffset = 0; isExitAdvance = true; }
              } else {
                const n = writer.utilities.getPreviousTextNode(
                  currentBoundaryElement.firstChild ?? currentBoundaryElement
                );
                if (n) { advNode = n; advOffset = (n as Text).length; isExitAdvance = true; }
              }
            } else {
              // DOM-external boundary.
              if (event.code === 'ArrowRight') {
                // Opening bracket: enter tag at its first text node.
                const n = writer.utilities.getNextTextNode(currentBoundaryElement);
                if (n) { advNode = n; advOffset = 0; isExitAdvance = false; }
              } else {
                // Closing bracket: enter tag at its last text node (symmetric with the
                // opening-bracket ArrowRight case above). Start search from the node AFTER
                // the tag so previousNode() lands on the tag's own last text descendant
                // instead of skipping past it.
                const n = writer.utilities.getPreviousTextNode(
                  currentBoundaryElement.nextSibling ?? currentBoundaryElement
                );
                if (n) { advNode = n; advOffset = (n as Text).length; isExitAdvance = false; }
              }
            }
            if (advNode) {
              event.preventDefault();
              // isSuppressBoundary: entry advances (not exits) land at offset 0 or textLen inside
              // the entity, which updateTagBoundaryState would normally treat as a boundary stop.
              // Suppress that so normal editing resumes immediately after entering.
              _pendingAdvance = { node: advNode, offset: advOffset, isExit: isExitAdvance, isSuppressBoundary: !isExitAdvance };
            }
            // If no advance target (e.g. tag at document boundary), fall through without
            // preventDefault so cursor can move naturally and avoid an infinite stop loop.
            return;
          } else {
            // First stop → enter virtual external (no cursor movement).
            // Also pin cursor via _pendingAdvance: TinyMCE's keyup may move cursor into the entity
            // even when default is prevented (e.g. cursor at offset=0 adjacent to entity).
            event.preventDefault();
            setVirtualExternal(true);
            _pendingAdvance = { node: c, offset: o };
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

    // TinyMCE entity-navigation exits the entity when ArrowLeft fires from offset=1 inside
    // entity text (browser moves cursor to offset=0, then TinyMCE keyup bounces it outside).
    // Intercept here (before browser moves cursor) so we can land at offset=0 (first stop),
    // letting the normal boundary-advance machinery take over from there.
    if (
      !currentBoundaryElement &&
      event.code === 'ArrowLeft' &&
      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
      writer.editor
    ) {
      const rng = writer.editor.selection.getRng();
      const cont = rng.startContainer;
      const off = rng.startOffset;
      const contParent = (cont as Text).parentElement;
      if (
        cont.nodeType === Node.TEXT_NODE &&
        off === 1 &&
        isTagOrCombinedEl(contParent) &&
        (contParent?.tagName === 'SPAN' || !!$(cont).closest('[_entity]')[0])
      ) {
        // Pin at offset=0 (entity start) rather than bouncing out.
        event.preventDefault();
        _pendingAdvance = { node: cont, offset: 0 };
      }
    }

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

  // Intercept character insertion at position 3 (cursor at textNode offset=0 inside entity).
  // TinyMCE normalizes (textNode, 0) to "before entity element" before processing input, so
  // typed characters land before the tag. We insert directly via DOM and bypass TinyMCE routing.
  const onBeforeInputHandler = (event: InputEvent) => {
    if (!writer.editor) return;
    if (event.inputType !== 'insertText' || !event.data) return;

    const rng = writer.editor.selection.getRng();
    const container = rng.startContainer;
    const offset = rng.startOffset;
    const parentEl = (container as Text).parentElement;
    if (currentBoundaryElement !== null) return;
    if (!rng.collapsed) return;

    // Inline entities are <span _tag="..."> with no _entity attr; combined entities are <div _entity>.
    const isInsideInlineEntity = parentEl?.tagName === 'SPAN' && parentEl.hasAttribute('_tag');
    const isInsideCombinedEntity = !!parentEl?.closest('[_entity]');
    if (
      container.nodeType !== Node.TEXT_NODE ||
      offset !== 0 ||
      (!isInsideInlineEntity && !isInsideCombinedEntity)
    ) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const textNode = container as Text;
    textNode.insertData(0, event.data);

    const newRng = writer.editor.getDoc().createRange();
    newRng.setStart(textNode, event.data.length);
    newRng.collapse(true);
    writer.editor.selection.setRng(newRng);

    writer.editor.undoManager.add();
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
        // Apply a pending advance computed in keydown. TinyMCE's keyup entity-navigation fires
        // before ours and may bounce cursor; applying here lets us override it cleanly.
        let advancedInsideEntity = false;
        let advancedExit = false;
        if (_pendingAdvance && writer.editor) {
          const { node, offset, isExit, isSuppressBoundary } = _pendingAdvance;
          advancedExit = !!isExit;
          console.log(`[pendingAdvance KU] ${event.code}`, { node, offset, nodeValue: node.nodeType === 3 ? JSON.stringify((node as Text).data) : null });
          _pendingAdvance = null;

          // Compute entity-membership BEFORE setRng so we can gate the suppression flag
          // and the doHighlightCheck skip correctly, even if setRng triggers a sync NodeChange.
          const nodeParent = (node as Text).parentElement;
          const isInlineEntity = nodeParent?.tagName === 'SPAN' && nodeParent.hasAttribute('_tag');
          const isCombinedEntity = !!$(node).closest('[_entity]')[0];
          if (isInlineEntity || isCombinedEntity) advancedInsideEntity = true;

          // Entry advances (L2R pos 3 at offset 0, R2L pos 3 at textLen) land at positions that
          // updateTagBoundaryState treats as atBoundary=true (to support natural approach from
          // inside). Set suppression BEFORE setRng so any sync NodeChange is already covered.
          if (isSuppressBoundary && advancedInsideEntity) {
            _suppressedBoundaryPosition = { node, offset };
          }

          const nr = writer.editor.getDoc().createRange();
          nr.setStart(node, offset);
          nr.collapse(true);
          writer.editor.selection.setRng(nr);
        }
        // Detect TinyMCE entity-bounce: cursor moved from external text into entity text without
        // a deliberate _pendingAdvance. Reverse it by restoring cursor to the pre-keydown position
        // (adjusted by one for the arrow direction) so boundary state can be computed correctly.
        const kdParent = (_keydownContainer as Text | null)?.parentElement;
        const kdIsInsideEntity =
          kdParent?.tagName === 'SPAN' && kdParent.hasAttribute('_tag')
            ? true
            : !!kdParent?.closest('[_entity]');
        if (
          !advancedInsideEntity &&
          (event.code === 'ArrowLeft' || event.code === 'ArrowRight') &&
          writer.editor &&
          _keydownContainer?.nodeType === Node.TEXT_NODE &&
          !kdIsInsideEntity
        ) {
          const rng = writer.editor.selection.getRng();
          const cur = rng.startContainer;
          const curParent = (cur as Text).parentElement;
          const curIsInsideEntity =
            curParent?.tagName === 'SPAN' && curParent.hasAttribute('_tag')
              ? true
              : !!curParent?.closest('[_entity]');
          if (cur.nodeType === Node.TEXT_NODE && curIsInsideEntity) {
            // Cursor bounced into entity from external text — restore to adjacent external position.
            const targetOffset = event.code === 'ArrowLeft' ? 0 : (_keydownContainer as Text).length;
            const nr = writer.editor.getDoc().createRange();
            nr.setStart(_keydownContainer, targetOffset);
            nr.collapse(true);
            writer.editor.selection.setRng(nr);
          }
        }

        if (!advancedInsideEntity) {
          doHighlightCheck(event);
        }
        updateTagBoundaryState();
        // Deliberate advance into/past a tag (entry to position 3, or exit past the boundary)
        // lands at the same offsets (0 / textLen) that updateTagBoundaryState also treats as
        // "natural approach" boundaries needing a highlight. Suppress it here so editing
        // resumes normally instead of re-showing the highlight we just navigated through.
        // Only clear boundary state for exits (cursor landed in adjacent external text).
        // Entry advances rely on _suppressedBoundaryPosition instead; the "first stop pin"
        // advance that enters virtual-external mode must NOT be cleared here or the vivid
        // highlight it just set will be wiped.
        if (advancedExit) clearTagBoundaryState();

        // === DEBUG: log keyup cursor state ===
        if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
          const sel2 = (writer.editor?.getDoc().defaultView ?? window).getSelection();
          console.log(`[boundary KU] ${event.code}`, {
            anchorNode: sel2?.anchorNode,
            anchorNodeType: sel2?.anchorNode?.nodeType === 3 ? 'TEXT' : sel2?.anchorNode?.nodeType === 1 ? 'ELEMENT' : sel2?.anchorNode?.nodeType,
            anchorOffset: sel2?.anchorOffset,
            anchorNodeValue: sel2?.anchorNode?.nodeType === 3 ? JSON.stringify((sel2.anchorNode as Text).data) : null,
            currentBoundaryElement: currentBoundaryElement?.getAttribute('id') ?? null,
            currentBoundaryIsExternal,
            currentVirtualExternal,
          });
        }
        // === END DEBUG ===
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
