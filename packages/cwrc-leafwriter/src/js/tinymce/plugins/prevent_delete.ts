// https://stackoverflow.com/questions/9856269/protect-div-element-from-being-deleted-within-tinymce
import tinymce, { type EditorEvent } from 'tinymce';
import { type LeafWriterEditor } from '../../../types';

//! THESE FUNCTIONS NEED BE REVIEWED: KEYBOARD_EVENT.keyCode is deprecated. -- see WIP on the commented code bellow
const contains = (array: number[], item: number) => {
  return array.indexOf(item) > -1;
};

//Returns whether val is within the range specified by min/max
const keyRange = (val: number, min: number, max: number) => {
  return val >= min && val <= max;
};

const keyWillDelete = (event: EditorEvent<KeyboardEvent>) => {
  const keyCode = event.keyCode;

  //cmd/ctrl+x or cmd/ctrl+back/del will all delete, but other shortcuts (cmd+a, cmd+b, cmd+s…) won't
  if (event.metaKey || event.ctrlKey)
    return event.key.toLowerCase() === 'x' || contains([8, 46], keyCode);

  return (
    contains([8, 9, 13, 46], keyCode) ||
    keyRange(keyCode, 48, 57) ||
    keyRange(keyCode, 65, 90) ||
    keyRange(keyCode, 96, 111) ||
    keyRange(keyCode, 186, 192) ||
    keyRange(keyCode, 219, 222)
  );
};

// const contains = (array: string[], item: string) => {
//   return array.indexOf(item) > -1;
// }

// //Returns whether val is within the range specified by min/max
// function r(val, min, max) {
//   return val >= min && val <= max;
// }

// const keyWillDelete = (event: EditorEvent<KeyboardEvent>) => {
//   const keyCode = event.code;
//   // const keyCode = event.;

//   //ctrl+x or ctrl+back/del will all delete, but otherwise it probably won't
//   if (event.ctrlKey) return ['KeyX', 'Delete', 'Backspace'].includes(keyCode);

//   return (
//     ['Backspace', 'Tab', 'Enter', 'Delete'].includes(keyCode) ||
//     // r(keyCode, 48, 57) || //numbers
//     ['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(keyCode) ||
//     r(keyCode, 65, 90) ||
//     ['Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadComma', 'NumpadSubtract', 'NumpadDecimal', 'NumpadDivide'].includes(keyCode) ||
//     // r(keyCode, 96, 111) ||
//     r(keyCode, 186, 192) ||
//     // r(keyCode, 219, 222)
//     ['"', "'"].includes(keyCode)
//   );
// }

const cancelKey = (event: EditorEvent<KeyboardEvent>) => {
  event.preventDefault();
  event.stopPropagation();
  return false;
};

// const isElementInline = (element: Element) => {
//   return element.nodeType === Node.TEXT_NODE ? true : element.nodeName.toLowerCase() === 'span';
// };

const deleteConfirm = (editor: LeafWriterEditor, range: Range, direction: 'back' | 'forward') => {
  const writer = editor.writer;
  if (!writer) return;

  // previousElementSibling/nextElementSibling are declared on Element and CharacterData
  // (which Text extends) but not on the generic Node type range.commonAncestorContainer
  // carries — this range is always inside editor content, so always one or the other.
  const container = range.commonAncestorContainer as Element | CharacterData;
  const element =
    direction === 'back' ? container.previousElementSibling : container.nextElementSibling;
  const parentElement = element ?? container.parentElement;
  if (!parentElement) return;

  const invalidDelete: boolean = writer.schemaManager.wouldDeleteInvalidate({
    contextNode: parentElement,
    removeContext: true,
    removeContents: false,
  });

  let msg = `<p>Delete "${parentElement.getAttribute('_tag')}" element?</p>`;
  let showConfirmKey = 'confirm-delete-tag';

  if (invalidDelete) {
    const _tagAttr = parentElement.getAttribute('_tag');
    msg = `<p>Deleting the "${_tagAttr}" element will make the document invalid. Do you wish to continue?</p>`;
    showConfirmKey = 'confirm-delete-tag-invalidating';
  }

  writer.dialogManager.confirm({
    title: 'Warning',
    msg,
    showConfirmKey,
    type: 'info',
    callback: (confirmed: boolean) => {
      const textNode =
        direction === 'back'
          ? writer.utilities.getPreviousTextNode(range.commonAncestorContainer, true)
          : writer.utilities.getNextTextNode(range.commonAncestorContainer, true);

      if (confirmed) {
        const id = parentElement.getAttribute('id');
        if (id) {
          const hasTextContent = parentElement.textContent !== '\uFEFF';
          writer.tagger.removeStructureTag(id, !hasTextContent);
        }
      }

      if (textNode?.parentNode) {
        // if parentNode is null that means the text was normalized as part of removeStructureTag
        const rng = editor.selection.getRng();
        rng.selectNode(textNode);
        rng.collapse(direction !== 'back');
        editor.selection.setRng(rng);
      }
      editor.focus();
    },
  });
};

const moveToTextNode = (
  event: EditorEvent<KeyboardEvent>,
  editor: LeafWriterEditor,
  range: Range,
  direction: 'back' | 'forward',
) => {
  const writer = editor.writer;
  if (!writer) return;

  const textNode: Node | null =
    direction === 'back'
      ? writer.utilities.getPreviousTextNode(range.commonAncestorContainer, true)
      : writer.utilities.getNextTextNode(range.commonAncestorContainer, true);

  if (textNode === null || textNode.parentNode === null) return;
  // if parentNode is null that means the text was normalized as part of removeStructureTag

  // parentNode !== null doesn't guarantee parentElement !== null (the parent could be a
  // non-Element node, e.g. a DocumentFragment) — that gap was previously unguarded.
  const nextParent = textNode.parentElement;
  if (!nextParent) return;

  const nextParentText = nextParent.textContent ?? '';
  const textNodeContent = textNode.textContent ?? '';

  if (
    nextParentText.length === 0 ||
    (nextParentText.length === 1 && nextParentText.charCodeAt(0) === 65279)
  ) {
    const rng = editor.selection.getRng();
    if (direction === 'back') {
      rng.setStart(textNode, textNodeContent.length);
      rng.setEnd(textNode, textNodeContent.length);
    } else {
      rng.setStart(textNode, 0);
      rng.setEnd(textNode, 0);
    }
    deleteConfirm(editor, rng, direction);
    return cancelKey(event);
  } else {
    if (nextParent.nodeName === 'SPAN') {
      if (nextParentText.length === 1) {
        // this keydown will delete all text content, leaving an empty tag
        // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
        nextParent.textContent = '\uFEFF';
        // set range to after the zwnb character
        if (nextParent.firstChild) {
          const rng = editor.selection.getRng();
          rng.setStart(nextParent.firstChild, 1);
          rng.setEnd(nextParent.firstChild, 1);
          editor.selection.setRng(rng);
        }
        return cancelKey(event);
      }
    } else {
      const rng = editor.selection.getRng();
      if (direction === 'back') {
        rng.setStart(textNode, textNodeContent.length);
        rng.setEnd(textNode, textNodeContent.length);
      } else {
        rng.setStart(textNode, 0);
        rng.setEnd(textNode, 0);
      }
      editor.selection.setRng(rng);
      // return cancelKey(event);
    }
  }
};

const preventDelete = (editor: LeafWriterEditor, event: EditorEvent<KeyboardEvent>) => {
  const range = editor.selection.getRng();

  // deleting individual characters
  if (range.collapsed && range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    // .length (character count) is declared on Text (a CharacterData), not the generic Node
    // type commonAncestorContainer carries — the nodeType check above guarantees it's a Text.
    const textContainer = range.commonAncestorContainer as Text;

    // backspace
    if (event.code === 'Backspace') {
      // start of element
      if (range.startOffset === 0) {
        if (textContainer.textContent && textContainer.textContent.length === 0) {
          deleteConfirm(editor, range, 'back');
          return cancelKey(event);
        } else {
          return moveToTextNode(event, editor, range, 'back');
        }
      } else if (
        range.startOffset === 1 &&
        textContainer.textContent &&
        textContainer.textContent.length === 1
      ) {
        if (textContainer.textContent.charCodeAt(0) === 65279) {
          if (textContainer.previousSibling === null) {
            deleteConfirm(editor, range, 'back');
            return cancelKey(event);
          } else {
            return moveToTextNode(event, editor, range, 'back');
          }
        } else {
          // this keydown will delete all text content, leaving an empty tag
          // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
          textContainer.textContent = '\uFEFF';
          // set range to after the zwnb character
          range.setStart(textContainer, 1);
          editor.selection.setRng(range);
          return cancelKey(event);
        }
      } else if (
        range.startOffset === 2 &&
        textContainer.textContent &&
        textContainer.textContent.length === 2
      ) {
        if (textContainer.textContent.charCodeAt(0) === 65279) {
          // this case is when we've already inserted a zwnb character
          // this keydown will delete the content, and will wrap the entire thing in a <span id="_mce_caret" data-mce-bogus="1"> tag, which will then get cleaned up by tinymce
          textContainer.textContent = '\uFEFF';
          range.setStart(textContainer, 1);
          editor.selection.setRng(range);
          return cancelKey(event);
        }
      }
    }
    // delete
    if (event.code === 'Delete') {
      // end of element
      if (range.startOffset === textContainer.length) {
        if (textContainer.length === 0) {
          deleteConfirm(editor, range, 'forward');
          return cancelKey(event);
        } else {
          return moveToTextNode(event, editor, range, 'forward');
        }
      } else if (range.startOffset === textContainer.length - 1 && textContainer.length === 1) {
        if (textContainer.textContent && textContainer.textContent.charCodeAt(0) === 65279) {
          if (textContainer.nextSibling === null) {
            deleteConfirm(editor, range, 'forward');
            return cancelKey(event);
          } else {
            return moveToTextNode(event, editor, range, 'forward');
          }
        } else {
          // this keydown will delete all text content, leaving an empty tag
          // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
          textContainer.textContent = '\uFEFF';
          // set range to after the zwnb character
          range.setStart(textContainer, 0);
          editor.selection.setRng(range);
          return cancelKey(event);
        }
      }
    }

    // deleting selection
  } else {
    let willDeleteTags = false;
    const clone = range.cloneContents();

    if (clone.childNodes.length === 1 && clone.childNodes[0].nodeType === Node.ELEMENT_NODE) {
      willDeleteTags = true;
    } else {
      for (let i = 0; i < clone.childNodes.length; i++) {
        const node = clone.childNodes[i];
        if (node.nodeType === Node.ELEMENT_NODE) {
          const prevNode = clone.childNodes[i - 1];
          const nextNode = clone.childNodes[i + 1];
          if (prevNode !== undefined && nextNode !== undefined) {
            willDeleteTags = true;
            break;
          }
        }
      }
    }

    if (willDeleteTags) {
      const writer = editor.writer;
      if (!writer) return;

      writer.dialogManager.confirm({
        title: 'Warning',
        msg: '<p>The text you are trying to delete contains XML elements, do you want to proceed?</p>',
        showConfirmKey: 'confirm-delete-tags-selection',
        type: 'info',
        callback: (confirmed: boolean) => {
          if (confirmed) {
            writer.tagger.processRemovedContent(range);

            editor.focus();
            if (event.code === 'Backspace' || event.code === 'Delete') {
              editor.getDoc().execCommand('insertText', false, '');
            } else {
              editor.getDoc().execCommand('insertText', false, event.key);
            }

            writer.event('contentChanged').publish();

            editor.undoManager.add();
          }
        },
      });
      return cancelKey(event);
    }
  }
};

tinymce.PluginManager.add('preventdelete', function (editor: LeafWriterEditor) {
  editor.on('keydown', (event) => {
    // Shift+Backspace / Shift+Delete unwrap inline tags in tinymceWrapper — do not
    // intercept those shortcuts here (especially at offset 0, where preventDelete
    // would cancel the key and make tag removal look broken).
    const isBackspaceOrDelete =
      event.key === 'Backspace' ||
      event.key === 'Delete' ||
      event.code === 'Backspace' ||
      event.code === 'Delete' ||
      event.keyCode === 8 ||
      event.keyCode === 46;
    if (event.shiftKey && isBackspaceOrDelete) return;
    if (keyWillDelete(event)) preventDelete(editor, event);
  });
});
