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
import { stripCjkWhitespaceInElement } from '../../utilities/cjkWhitespace';
import { normalizePastedParagraphs, fixNestedPastedParagraphs, removeEmptyParagraphs } from './normalizePastedParagraphs';
import {
  buildLeafWriterClipboardPayload,
  detectPasteAmbiguity,
  escapeHtml,
  isLeafWriterClipboardPayload,
  LEAF_WRITER_CLIPBOARD_MIME,
  normalizeClipboardText,
  parseXmlFragment,
  textToLineBreakXml,
} from './pasteSpecial';
import './plugins/treepaste';
import { initEditorZoom } from './editorZoom';

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

  const isNodeInEditorBody = (editor: LeafWriterEditor, node: Node | null | undefined) => {
    if (!node) return false;
    const body = editor.getBody();
    return node === body || body.contains(node);
  };

  const isPasteBinNode = (node: Node | null | undefined) => {
    let current: Node | null | undefined = node;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE && current.textContent?.includes('%MCEPASTEBIN%')) {
        return true;
      }
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as Element;
        if (
          element.id === 'mcepastebin' ||
          element.getAttribute('id') === 'mcepastebin' ||
          element.getAttribute('data-mce-bogus') === 'all'
        ) {
          return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  };

  const escapeAttribute = (value: string) =>
    escapeHtml(value).replace(/'/g, '&apos;');

  const buildEditorTagAttributes = (node: Element) => {
    const attrs: Record<string, string> = {};
    let html = '';

    Array.from(node.attributes).forEach((attr) => {
      attrs[attr.name] = attr.value;
      if (attr.name === 'id') return;
      html += ` ${attr.name}="${escapeAttribute(attr.value)}"`;
    });

    const jsonAttrsString = JSON.stringify(attrs).replace(/"/g, '&quot;');
    return `${html} _attributes="${jsonAttrsString}"`;
  };

  const findTagNameFromNode = (node: Node | null, stopAt: Node): string | null => {
    let current: Node | null = node;
    while (current && current !== stopAt) {
      if (current.nodeType === Node.ELEMENT_NODE && (current as Element).hasAttribute('_tag')) {
        return (current as Element).getAttribute('_tag');
      }
      current = current.parentNode;
    }
    return null;
  };

  const getInsertionParentTag = (editor: LeafWriterEditor): string | null => {
    const body = editor.getBody();
    const selectionTag = findTagNameFromNode(editor.selection.getNode(), body);
    if (selectionTag) return selectionTag;

    const currentNodeTag = findTagNameFromNode(editor.currentNode ?? null, body);
    if (currentNodeTag) return currentNodeTag;

    try {
      return findTagNameFromNode(editor.selection.getRng()?.commonAncestorContainer ?? null, body);
    } catch {
      return null;
    }
  };

  const getInsertionParentTagFromRange = (
    editor: LeafWriterEditor,
    range: Range | null,
  ): string | null => {
    if (!range) return null;
    return findTagNameFromNode(range.commonAncestorContainer, editor.getBody());
  };

  interface PasteInsertionContext {
    parentTag: string | null;
    parentCanContainText: boolean;
    /** Nearest block-tag ancestor of the paste range, when the caret sits inside one. */
    blockEl: Element | null;
    /** Tag of the block ancestor's parent — where hoisted paragraphs would be inserted. */
    blockParentTag: string | null;
  }

  let pendingPasteTargetRange: Range | null = null;
  let pendingPasteTargetRangeCapturedAt = 0;
  let lastKnownEditorRange: Range | null = null;
  let lastKnownEditorRangeCapturedAt = 0;

  const rangeFromStaticRange = (doc: Document, staticRange: StaticRange): Range => {
    const range = doc.createRange();
    range.setStart(staticRange.startContainer, staticRange.startOffset);
    range.setEnd(staticRange.endContainer, staticRange.endOffset);
    return range;
  };

  const getPendingPasteTargetRange = (editor: LeafWriterEditor): Range | null => {
    if (!pendingPasteTargetRange) return null;
    if (Date.now() - pendingPasteTargetRangeCapturedAt > 2000) return null;
    if (
      !isNodeInEditorBody(editor, pendingPasteTargetRange.startContainer) ||
      !isNodeInEditorBody(editor, pendingPasteTargetRange.endContainer)
    ) {
      return null;
    }
    return pendingPasteTargetRange.cloneRange();
  };

  const rememberEditorRange = (editor: LeafWriterEditor) => {
    try {
      const range = editor.selection.getRng()?.cloneRange();
      if (
        !range ||
        !isNodeInEditorBody(editor, range.startContainer) ||
        !isNodeInEditorBody(editor, range.endContainer)
      ) {
        return;
      }
      if (
        isPasteBinNode(range.startContainer) ||
        isPasteBinNode(range.endContainer) ||
        isPasteBinNode(range.commonAncestorContainer)
      ) {
        return;
      }

      lastKnownEditorRange = range;
      lastKnownEditorRangeCapturedAt = Date.now();
    } catch {
      // TinyMCE can throw while the iframe selection is settling.
    }
  };

  const getLastKnownEditorRange = (editor: LeafWriterEditor): Range | null => {
    if (!lastKnownEditorRange) return null;
    if (Date.now() - lastKnownEditorRangeCapturedAt > 30000) return null;
    if (
      !isNodeInEditorBody(editor, lastKnownEditorRange.startContainer) ||
      !isNodeInEditorBody(editor, lastKnownEditorRange.endContainer)
    ) {
      return null;
    }
    if (
      isPasteBinNode(lastKnownEditorRange.startContainer) ||
      isPasteBinNode(lastKnownEditorRange.endContainer) ||
      isPasteBinNode(lastKnownEditorRange.commonAncestorContainer)
    ) {
      return null;
    }
    return lastKnownEditorRange.cloneRange();
  };

  const findBlockElFromRange = (editor: LeafWriterEditor, range: Range | null): Element | null => {
    if (!range) return null;
    const blockTag = writer.schemaManager.getBlockTag();
    const body = editor.getBody();
    let node: Node | null = range.commonAncestorContainer;
    while (node && node !== body) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).getAttribute('_tag') === blockTag
      ) {
        return node as Element;
      }
      node = node.parentNode;
    }
    return null;
  };

  const capturePasteInsertionContext = (
    editor: LeafWriterEditor,
    range: Range | null = null,
  ): PasteInsertionContext => {
    const parentTag = getInsertionParentTagFromRange(editor, range) ?? getInsertionParentTag(editor);
    const blockEl = findBlockElFromRange(editor, range);
    const blockParentTag = blockEl
      ? findTagNameFromNode(blockEl.parentNode, editor.getBody())
      : null;
    return {
      parentTag,
      parentCanContainText: parentTag ? writer.schemaManager.canTagContainText(parentTag) : false,
      blockEl,
      blockParentTag,
    };
  };

  const canImportXmlFragment = (
    context: PasteInsertionContext,
    fragmentDocument: XMLDocument,
  ) => {
    if (!context.parentTag) return false;

    return Array.from(fragmentDocument.documentElement.childNodes).every((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        return text.trim().length === 0 || context.parentCanContainText;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return true;

      const element = node as Element;
      return (
        writer.schemaManager.isTagValidChildOfParent(element.nodeName, context.parentTag!) ||
        writer.schemaManager
          .getParentsForTag(element.nodeName)
          .some((parent) => parent.name === context.parentTag)
      );
    });
  };

  const buildEditorFragmentFromXml = (
    context: PasteInsertionContext,
    xml: string,
  ): { content?: string; error?: string } => {
    const parsed = parseXmlFragment(xml);
    if (parsed.error) return { error: parsed.error };
    if (!canImportXmlFragment(context, parsed.document)) {
      return { error: 'This XML is well formed, but not valid in this location.' };
    }

    const content = Array.from(parsed.document.documentElement.childNodes)
      .map((node): string => buildEditorHtmlFromXmlNode(node))
      .join('');

    return { content };
  };

  function buildEditorHtmlFromXmlNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.textContent ?? ''}-->`;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as Element;
    const tagName = element.nodeName;
    const editorTagName = writer.schemaManager.getTagForEditor(tagName);
    const id = writer.getUniqueId('dom_');
    const canContainText = writer.schemaManager.canTagContainText(tagName);
    const children = Array.from(element.childNodes).map(buildEditorHtmlFromXmlNode).join('');
    const emptyText = canContainText && children.length === 0 ? '\uFEFF' : '';

    return `<${editorTagName} id="${id}" _tag="${tagName}" _textallowed="${canContainText}"${buildEditorTagAttributes(element)}>${children}${emptyText}</${editorTagName}>`;
  }

  const textToParagraphXml = (text: string, blockTag = 'p') => {
    const normalized = text.replace(/\r\n?/g, '\n');
    // Blank lines separate paragraphs when present; otherwise every line break does,
    // since the paste dialog only offers this mode for text without blank lines.
    const separator = /\n{2,}/.test(normalized) ? /\n{2,}/ : /\n/;
    return normalized
      .split(separator)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map(
        (paragraph) =>
          `<${blockTag}>${paragraph.split('\n').map(escapeHtml).join('<lb/>')}</${blockTag}>`,
      )
      .join('');
  };

  const textToInlineLineBreakXml = (text: string) =>
    text.replace(/\r\n?/g, '\n').split('\n').map(escapeHtml).join('<lb/>');

  const canInsertChildTag = (childTag: string, parentTag: string | null) =>
    Boolean(parentTag && writer.schemaManager.isTagValidChildOfParent(childTag, parentTag));

  const getSavedPasteDefault = (ambiguity: string, fallback: string) => {
    try {
      return localStorage.getItem(`leafwriter.pasteSpecial.default.${ambiguity}`) || fallback;
    } catch {
      return fallback;
    }
  };

  const savePasteDefault = (ambiguity: string, mode: string) => {
    try {
      localStorage.setItem(`leafwriter.pasteSpecial.default.${ambiguity}`, mode);
    } catch {
      // localStorage may be unavailable.
    }
  };

  const buildPasteModeContent = (
    context: PasteInsertionContext,
    mode: string,
    text: string,
  ): { content?: string; error?: string; splitBlock?: boolean } => {
    if (mode === 'xml') return buildEditorFragmentFromXml(context, text);

    if (mode === 'line-breaks') {
      if (context.parentCanContainText && canInsertChildTag('lb', context.parentTag)) {
        return buildEditorFragmentFromXml(context, textToInlineLineBreakXml(text));
      }

      if (canInsertChildTag('p', context.parentTag)) {
        return buildEditorFragmentFromXml(context, textToLineBreakXml(text));
      }

      return { error: 'Line breaks are not valid in this location.' };
    }

    if (mode === 'paragraphs') {
      // Caret inside a paragraph: hoist the paste to paragraph level so beginners get
      // real paragraphs (the host paragraph is split at the caret on insertion).
      const blockTag = writer.schemaManager.getBlockTag();
      if (
        context.blockEl &&
        context.blockParentTag &&
        canInsertChildTag(blockTag, context.blockParentTag)
      ) {
        const hoisted = buildEditorFragmentFromXml(
          {
            parentTag: context.blockParentTag,
            parentCanContainText: writer.schemaManager.canTagContainText(context.blockParentTag),
            blockEl: null,
            blockParentTag: null,
          },
          textToParagraphXml(text, blockTag),
        );
        if (hoisted.content) return { ...hoisted, splitBlock: true };
      }

      if (context.parentTag === 'p' && context.parentCanContainText) {
        const xml = canInsertChildTag('lb', context.parentTag)
          ? textToInlineLineBreakXml(text)
          : escapeHtml(text.replace(/\r\n?|\n/g, ' '));
        return buildEditorFragmentFromXml(context, xml);
      }

      if (canInsertChildTag('p', context.parentTag)) {
        return buildEditorFragmentFromXml(context, textToParagraphXml(text));
      }

      if (context.parentCanContainText) {
        return buildEditorFragmentFromXml(context, escapeHtml(text.replace(/\r\n?|\n/g, ' ')));
      }

      return { error: 'Paragraphs are not valid in this location.' };
    }

    if (mode === 'plain') {
      if (context.parentTag && context.parentCanContainText) {
        return buildEditorFragmentFromXml(context, escapeHtml(text));
      }
      if (canInsertChildTag('p', context.parentTag)) {
        return buildEditorFragmentFromXml(context, `<p>${escapeHtml(text)}</p>`);
      }
      return { error: 'Text is not valid in this location.' };
    }

    return buildEditorFragmentFromXml(context, escapeHtml(text));
  };

  /**
   * Splits the block element at the range's start and inserts the pasted paragraphs
   * between the two halves. Empty halves and duplicated ids are handled by the
   * post-paste cleanup (removeEmptyParagraphs / processNewContent).
   */
  const insertEditorContentSplittingBlock = (
    editor: LeafWriterEditor,
    content: string,
    range: Range,
    blockEl: Element,
  ) => {
    const doc = editor.getDoc();
    range.deleteContents();

    const tailRange = doc.createRange();
    tailRange.setStart(range.startContainer, range.startOffset);
    tailRange.setEnd(blockEl, blockEl.childNodes.length);
    const tailBlock = blockEl.cloneNode(false) as Element;
    tailBlock.appendChild(tailRange.extractContents());
    blockEl.parentNode?.insertBefore(tailBlock, blockEl.nextSibling);

    const container = doc.createElement('div');
    container.innerHTML = content;
    const fragment = doc.createDocumentFragment();
    while (container.firstChild) fragment.appendChild(container.firstChild);
    blockEl.parentNode?.insertBefore(fragment, tailBlock);

    const collapseRange = doc.createRange();
    collapseRange.setStart(tailBlock, 0);
    collapseRange.collapse(true);
    editor.selection.setRng(collapseRange);
  };

  const insertEditorContentAtRange = (
    editor: LeafWriterEditor,
    content: string,
    range: Range,
  ) => {
    const doc = editor.getDoc();
    const container = doc.createElement('div');
    container.innerHTML = content;

    const fragment = doc.createDocumentFragment();
    let lastNode: ChildNode | null = null;
    while (container.firstChild) {
      lastNode = container.firstChild;
      fragment.appendChild(container.firstChild);
    }

    range.deleteContents();
    range.insertNode(fragment);

    if (lastNode) {
      const collapseRange = doc.createRange();
      collapseRange.setStartAfter(lastNode);
      collapseRange.collapse(true);
      editor.selection.setRng(collapseRange);
    }
  };

  const showPasteSpecialDialog = ({
    ambiguity,
    context,
    onPaste,
    text,
  }: {
    ambiguity: string;
    context: PasteInsertionContext;
    onPaste: (content: string, splitBlock: boolean) => void;
    text: string;
  }) => {
    const xmlStatus = buildEditorFragmentFromXml(context, text);
    let selectedMode = getSavedPasteDefault(
      ambiguity,
      ambiguity === 'xml' && xmlStatus.content ? 'xml' : 'paragraphs',
    );
    const modes = [
      { mode: 'paragraphs', label: 'Paragraphs', description: 'Blank lines create new paragraphs; without blank lines, every line break does.' },
      { mode: 'line-breaks', label: 'Line breaks', description: 'Single line breaks become lb elements.' },
      {
        mode: 'xml',
        label: 'XML fragment',
        description: xmlStatus.content
          ? 'Import well-formed XML as document structure.'
          : xmlStatus.error || 'XML is not importable here.',
        disabled: !xmlStatus.content,
      },
      { mode: 'plain', label: 'Plain text', description: 'Paste markup characters as text.' },
    ];

    if (modes.some((option) => option.mode === selectedMode && option.disabled)) {
      selectedMode = 'paragraphs';
    }

    const $dialog = $('<div class="ljb-paste-special" />');
    const $list = $('<div role="listbox" aria-label="Paste options" />').appendTo($dialog);
    modes.forEach((option) => {
      const $button = $('<button type="button" class="ljb-paste-special-option" />')
        .attr('data-mode', option.mode)
        .prop('disabled', option.disabled === true)
        .css({
          display: 'block',
          width: '100%',
          textAlign: 'left',
          margin: '0 0 8px',
          padding: '8px',
        })
        .append($('<strong />').text(option.label))
        .append($('<div />').css({ fontSize: '12px', opacity: 0.75 }).text(option.description))
        .appendTo($list);
      if (option.mode === selectedMode) $button.addClass('selected');
    });

    const updateSelection = (nextMode: string) => {
      const option = modes.find((item) => item.mode === nextMode && !item.disabled);
      if (!option) return;
      selectedMode = option.mode;
      $list.find('button').removeClass('selected').css({ outline: '' });
      $list
        .find(`button[data-mode="${selectedMode}"]`)
        .addClass('selected')
        .css({ outline: '2px solid currentColor' })
        .trigger('focus');
    };

    const finish = (saveDefault: boolean) => {
      if (saveDefault) savePasteDefault(ambiguity, selectedMode);
      const result = buildPasteModeContent(context, selectedMode, text);
      if (result.content) onPaste(result.content, result.splitBlock === true);
      if (!result.content && result.error) {
        writer.dialogManager.show('message', {
          title: 'Paste Special',
          msg: result.error,
          type: 'error',
        });
      }
      $dialog.dialog('destroy').remove();
    };

    $dialog.on('click', 'button[data-mode]', function () {
      updateSelection(String($(this).attr('data-mode')));
    });

    $dialog.on('dblclick', 'button[data-mode]', function () {
      if (!$(this).prop('disabled')) finish(false);
    });

    $dialog.on('keydown', (event) => {
      const available = modes.filter((option) => !option.disabled);
      const index = available.findIndex((option) => option.mode === selectedMode);
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        updateSelection(available[(index + 1) % available.length].mode);
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        updateSelection(available[(index - 1 + available.length) % available.length].mode);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(false);
      }
    });

    $dialog.dialog({
      title: 'Paste Special',
      modal: true,
      resizable: false,
      width: 420,
      close: () => {
        $dialog.dialog('destroy').remove();
      },
      buttons: [
        { text: 'Paste', click: () => finish(false) },
        { text: 'Save as default', click: () => finish(true) },
        {
          text: 'Cancel',
          click: () => {
            $dialog.dialog('destroy').remove();
          },
        },
      ],
    });
    updateSelection(selectedMode);
  };

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

    paste_postprocess: (_plugin: any, args: any) => {
      // Opt-in: strip inter-character whitespace from pasted content too, so
      // pasted spaces/line breaks between East Asian characters don't show as
      // gaps. Runs before normalization so downstream sees the cleaned text.
      if (args.node && writer.overmindState?.editor?.stripCjkWhitespace) {
        stripCjkWhitespaceInElement(args.node);
      }
      normalizePastedParagraphs(writer, args.node);
      writer.tagger.processNewContent(args.node);
      setTimeout(() => {
        if (writer.editor) {
          const body = writer.editor.getBody();
          fixNestedPastedParagraphs(body);
          removeEmptyParagraphs(body, writer.schemaManager.getBlockTag());
        }
        // need to fire contentPasted here, after the content is actually within the document
        writer.event('contentPasted').publish({
          fromLeafWriter: Boolean((writer.editor as any)?._leafWriterLastPasteFromLeafWriter),
        });
        if (writer.editor) {
          (writer.editor as any)._leafWriterLastPasteFromLeafWriter = false;
        }
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

        initEditorZoom(editor);

        const body = editor.getBody();

        // highlight tracking
        body.addEventListener('keydown', onKeyDownHandler, true);
        body.addEventListener('keyup', (event) => {
          onKeyUpHandler(event);
          rememberEditorRange(editor);
        });
        body.addEventListener('mouseup', () => rememberEditorRange(editor), true);
        body.addEventListener('focusin', () => rememberEditorRange(editor), true);
        body.addEventListener(
          'beforeinput',
          (event: InputEvent) => {
            if (writer.isTextLocked === true) {
              const type = event.inputType ?? '';
              if (type.startsWith('insert') || type.startsWith('delete')) {
                event.preventDefault();
              }
              return;
            }

            if (event.inputType !== 'insertFromPaste') return;

            const targetRanges =
              typeof event.getTargetRanges === 'function' ? event.getTargetRanges() : [];
            const targetRange = targetRanges[0];
            pendingPasteTargetRange = targetRange
              ? rangeFromStaticRange(editor.getDoc(), targetRange)
              : null;
            pendingPasteTargetRangeCapturedAt = Date.now();
          },
          true,
        );

        // attach mouseUp to doc because body doesn't always extend to full height of editor panel
        if (editor.iframeElement?.contentDocument) {
          const iframeDoc = editor.iframeElement.contentDocument;
          iframeDoc.addEventListener('mouseup', (event) => {
            onMouseUpHandler(event);
            rememberEditorRange(editor);
          });
          iframeDoc.addEventListener(
            'selectionchange',
            () => {
              if (editor.hasFocus()) rememberEditorRange(editor);
            },
            true,
          );
          iframeDoc.addEventListener(
            'keydown',
            (event: KeyboardEvent) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                dispatchDesktopOpenFind();
              }
              // Use event.key (layout-aware) rather than event.code/keyCode
              // (physical position) so this fires on Dvorak and other
              // non-QWERTY layouts too.
              if ((event.metaKey || event.ctrlKey) && event.key === '.') {
                event.preventDefault();
                writer.overmindActions.editor.toggleShowTags();
              }
            },
            true,
          );
        }

        writer.event('tinymceInitialized').publish(writer);

        editor.on('Change', onChangeHandler);
        editor.on('Undo', onUndoHandler);
        editor.on('Redo', onRedoHandler);
        editor.on('focus', () => {
          rememberEditorRange(editor);
        });
        editor.on('BeforeAddUndo', () => {
          /*log.info('before add undo'); */
        });
        // editor.on();
        editor.on('NodeChange', (event) => {
          onNodeChangeHandler(event.element);
          rememberEditorRange(editor);
        });
        editor.on('copy', onCopyHandler);
        editor.on(
          'paste',
          (event: ClipboardEvent) => {
            if (writer.isTextLocked === true) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }

            const clipboard = event.clipboardData;
            if (!clipboard) return;

            const fromLeafWriter = isLeafWriterClipboardPayload(
              clipboard.getData(LEAF_WRITER_CLIPBOARD_MIME),
            );
            const text = normalizeClipboardText(
              clipboard.getData('text/plain') || clipboard.getData('Text') || '',
            );
            const ambiguity = detectPasteAmbiguity({ fromLeafWriter, text });
            if (!ambiguity) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            const bookmark = editor.selection.getBookmark(1);
            const tinyMcePasteRange = editor.selection.getRng()?.cloneRange();
            const browserPasteTargetRange = getPendingPasteTargetRange(editor);
            const lastKnownPasteRange = getLastKnownEditorRange(editor);
            pendingPasteTargetRange = null;
            const pasteRange = browserPasteTargetRange ?? lastKnownPasteRange ?? tinyMcePasteRange;
            const pasteContext = capturePasteInsertionContext(editor, pasteRange);
            showPasteSpecialDialog({
              ambiguity,
              context: pasteContext,
              text,
              onPaste: (content, splitBlock) => {
                editor.focus();
                try {
                  if (pasteRange) {
                    editor.selection.setRng(pasteRange);
                  } else {
                    editor.selection.moveToBookmark(bookmark);
                  }
                } catch {
                  editor.selection.moveToBookmark(bookmark);
                }
                if (!pasteContext.parentTag) return;
                (editor as any)._leafWriterLastPasteFromLeafWriter = fromLeafWriter;
                // Commit the pre-paste state so a single undo returns exactly here.
                editor.undoManager.add();
                const liveRange = editor.selection.getRng();
                const savedRangeIsUsable =
                  pasteRange &&
                  isNodeInEditorBody(editor, pasteRange.startContainer) &&
                  isNodeInEditorBody(editor, pasteRange.endContainer);
                const restoredRange = savedRangeIsUsable ? pasteRange : liveRange;
                const blockEl = pasteContext.blockEl;
                if (
                  splitBlock &&
                  blockEl &&
                  isNodeInEditorBody(editor, blockEl) &&
                  blockEl.contains(restoredRange.startContainer) &&
                  blockEl.contains(restoredRange.endContainer)
                ) {
                  insertEditorContentSplittingBlock(editor, content, restoredRange, blockEl);
                } else {
                  insertEditorContentAtRange(editor, content, restoredRange);
                }
                setTimeout(() => {
                  const body = editor.getBody();
                  normalizePastedParagraphs(writer, body);
                  writer.tagger.processNewContent(body);
                  fixNestedPastedParagraphs(body);
                  removeEmptyParagraphs(body, writer.schemaManager.getBlockTag());
                  // Commit the fully processed paste as one undo level.
                  editor.undoManager.add();
                  writer.event('contentPasted').publish({ fromLeafWriter });
                  writer.event('contentChanged').publish();
                }, 0);
              },
            });
          },
          true,
        );

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

    // Opt-in: strip inter-character whitespace from the rendered body so
    // pretty-printed East Asian source doesn't show as gaps. Done post-render
    // (here, on every load path) so it's guaranteed to affect what's on screen.
    if (overmindState?.editor?.stripCjkWhitespace) {
      stripCjkWhitespaceInElement(writer.editor.getBody());
    }

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
  // Which side of the tag an external boundary sits on — 'before' means the tag is the next
  // thing to the right (Delete should unwrap it, Backspace should act on preceding text
  // normally); 'after' means the tag is the next thing to the left (Backspace should unwrap
  // it, Delete should act on following text normally). null when not at an external boundary.
  let currentBoundarySide: 'before' | 'after' | null = null;

  const applyBoundaryClasses = (
    activeEl: Element | null,
    boundaryEl: Element | null,
    externalBoundary = false,
    boundarySide: 'before' | 'after' | null = null,
  ) => {
    if (currentActiveElement) {
      currentActiveElement.classList.remove('tag-cursor-active', 'tag-at-boundary');
      (currentActiveElement as HTMLElement).style.removeProperty('--lw-bubble-left');
    }
    currentActiveElement = activeEl;
    currentBoundaryElement = boundaryEl;
    currentBoundaryIsExternal = externalBoundary;
    currentBoundarySide = externalBoundary ? boundarySide : null;
    if (activeEl) {
      activeEl.classList.add('tag-cursor-active');
      if (activeEl.tagName === 'DIV') {
        const indent = getComputedStyle(activeEl).textIndent;
        if (indent && indent !== '0px') {
          (activeEl as HTMLElement).style.setProperty('--lw-bubble-left', indent);
        }
      }
    }
    if (boundaryEl) boundaryEl.classList.add('tag-at-boundary');
  };

  const clearTagBoundaryState = () => applyBoundaryClasses(null, null);

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
    // 'before' = tag is the next sibling (cursor sits right before it); 'after' = tag is the
    // previous sibling (cursor sits right after it). See currentBoundarySide above.
    let boundarySide: 'before' | 'after' | null = null;

    if (container.nodeType === Node.TEXT_NODE) {
      const textLen = (container as Text).length;
      const parent = container.parentElement;

      if (offset === 0) {
        const prevSib = container.previousSibling;
        const via = tagElThroughEntity(prevSib);
        if (via) { tagEl = via; atBoundary = true; externalBoundary = true; boundarySide = 'after'; }
        else if (isTagOrCombinedEl(parent)) { tagEl = parent; atBoundary = true; }
      } else if (offset >= textLen) {
        const nextSib = container.nextSibling;
        const via = tagElThroughEntity(nextSib);
        if (via) { tagEl = via; atBoundary = true; externalBoundary = true; boundarySide = 'before'; }
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

      if (viaAfter) { tagEl = viaAfter; atBoundary = true; externalBoundary = true; boundarySide = 'before'; }
      else if (viaBefore) { tagEl = viaBefore; atBoundary = true; externalBoundary = true; boundarySide = 'after'; }
      else if (isTagOrCombinedEl(el)) {
        tagEl = el;
        atBoundary = offset === 0 || offset >= el.childNodes.length;
      }
    }

    if (!tagEl) { applyBoundaryClasses(null, null); return; }

    applyBoundaryClasses(tagEl, atBoundary ? tagEl : null, externalBoundary, boundarySide);
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

  const NAVIGATION_KEYS = new Set([
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'ArrowUp',
    'ArrowDown',
    'ArrowRight',
    'ArrowLeft',
    'Tab',
    'Escape',
  ]);

  const shouldBlockWhenTextLocked = (event: KeyboardEvent): boolean => {
    if (writer.isTextLocked !== true) return false;
    if (event.isComposing) return false;
    if (NAVIGATION_KEYS.has(event.code)) return false;

    const mod = tinymce.isMac ? event.metaKey : event.ctrlKey;
    if (mod) {
      const key = event.key.toLowerCase();
      if (key === 'a' || key === 'f' || key === '.') return false;
      return true;
    }

    return true;
  };

  const onKeyDownHandler = (event: KeyboardEvent) => {
    if (!writer.editor) return;
    // if (writer.isReadOnly === true) return

    writer.editor.lastKeyPress = event.code; // store the last key press

    // At an internal end-boundary (cursor inside _tag element at end of its text), block Delete
    // so the browser doesn't merge content from after the tag into the element.
    if (
      currentBoundaryElement &&
      !currentBoundaryIsExternal &&
      event.code === 'Delete' &&
      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
    ) {
      event.preventDefault();
      return;
    }

    // Shift+Backspace / Shift+Delete: delete the innermost tag at the cursor, regardless of
    // exact cursor position within it (not just at a boundary). To delete an outer wrapper,
    // either press this twice (innermost first, then its parent) or use the markup tree panel.
    if (
      event.shiftKey &&
      (event.code === 'Backspace' || event.code === 'Delete') &&
      !event.ctrlKey && !event.metaKey && !event.altKey &&
      writer.isReadOnly !== true &&
      writer.isTextLocked !== true
    ) {
      const node = writer.editor.selection.getNode();
      const tagEl = isElement(node) ? node.closest('[_tag]') : null;
      const tagName = tagEl?.getAttribute('_tag');
      if (
        tagEl &&
        tagName &&
        tagName !== writer.schemaManager.getRoot() &&
        tagName !== writer.schemaManager.getHeader()
      ) {
        const id = tagEl.getAttribute('id');
        if (id) {
          event.preventDefault();
          clearTagBoundaryState();
          writer.tagger.removeTag(id);
          return;
        }
      }
    }

    // Backspace/Delete at a tag boundary: unwrap the tag — but only the key that actually
    // points "into" the tag. Cursor sitting right before a tag (boundarySide 'before') means
    // Delete (forward) should unwrap it, while Backspace (backward) should act on whatever
    // precedes the cursor normally; mirror image for 'after'. Without this check both keys
    // unwrapped the tag regardless of direction, making it impossible to e.g. backspace a
    // space immediately preceding a tag without first stepping away from the boundary.
    if (
      currentBoundaryElement &&
      currentBoundaryIsExternal &&
      ((event.code === 'Delete' && currentBoundarySide === 'before') ||
        (event.code === 'Backspace' && currentBoundarySide === 'after')) &&
      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
      writer.isReadOnly !== true &&
      writer.isTextLocked !== true
    ) {
      const id = currentBoundaryElement.getAttribute('id');
      if (id) {
        event.preventDefault();
        clearTagBoundaryState();
        writer.tagger.removeTag(id);
        return;
      }
    }

    if (tinymce.isMac ? event.metaKey : event.ctrlKey) return;

    //allow select all
    if ((tinymce.isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      return;
    }

    if (writer.isReadOnly === true) return;

    const desktopTagging = window.__desktopTagging;
    // Suppress Enter/NumpadEnter briefly after a jQuery UI dialog closes.
    // The key used to confirm the dialog (Enter) can leak into TinyMCE once focus returns,
    // which would unintentionally open the tag command popup via matchesEditorTagPopup.
    // dialogManager.ts sets writer._suppressEnterUntil on dialogclose.
    const isEnter = event.code === 'Enter' || event.code === 'NumpadEnter';
    const suppressUntil = (writer as any)._suppressEnterUntil ?? 0;
    const enterSuppressed = isEnter && Date.now() < suppressUntil;
    const taggingHandled = !enterSuppressed && Boolean(desktopTagging?.handleEditorKeyDown(event));
    if (taggingHandled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (shouldBlockWhenTextLocked(event)) {
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
      }
    }

    if (writer.isReadOnly === true) return;
    if (writer.isTextLocked === true) return;

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

    if (event.clipboardData?.setData) {
      event.clipboardData.setData(LEAF_WRITER_CLIPBOARD_MIME, buildLeafWriterClipboardPayload());
    }

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
