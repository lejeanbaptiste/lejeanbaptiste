// https://stackoverflow.com/questions/9856269/protect-div-element-from-being-deleted-within-tinymce
//@ts-nocheck
import tinymce from 'tinymce';
//! THESE FUNCTIONS NEED BE REVIEWED: KEYBOARD_EVENT.keyCode is deprecated. -- see WIP on the commented code bellow
const contains = (array, item) => {
    return array.indexOf(item) > -1;
};
//Returns whether val is within the range specified by min/max
const keyRange = (val, min, max) => {
    return val >= min && val <= max;
};
const keyWillDelete = (event) => {
    const keyCode = event.keyCode;
    //ctrl+x or ctrl+back/del will all delete, but otherwise it probably won't
    if (event.ctrlKey)
        return event.key == 'x' || contains([8, 46], keyCode);
    return (contains([8, 9, 13, 46], keyCode) ||
        keyRange(keyCode, 48, 57) ||
        keyRange(keyCode, 65, 90) ||
        keyRange(keyCode, 96, 111) ||
        keyRange(keyCode, 186, 192) ||
        keyRange(keyCode, 219, 222));
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
const cancelKey = (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
};
// const isElementInline = (element: Element) => {
//   return element.nodeType === Node.TEXT_NODE ? true : element.nodeName.toLowerCase() === 'span';
// };
const deleteConfirm = (editor, range, direction) => {
    let element;
    if (direction === 'back') {
        element =
            range.commonAncestorContainer.previousElementSibling ||
                range.commonAncestorContainer.parentElement;
    }
    else {
        element =
            range.commonAncestorContainer.nextElementSibling ||
                range.commonAncestorContainer.parentElement;
    }
    const invalidDelete = editor.writer.schemaManager.wouldDeleteInvalidate({
        contextNode: element,
        removeContext: true,
        removeContents: false,
    });
    let msg = `<p>Delete "${element.getAttribute('_tag')}" element?</p>`;
    let showConfirmKey = 'confirm-delete-tag';
    if (invalidDelete) {
        const _tagAttr = element.getAttribute('_tag');
        msg = `<p>Deleting the "${_tagAttr}" element will make the document invalid. Do you wish to continue?</p>`;
        showConfirmKey = 'confirm-delete-tag-invalidating';
    }
    editor.writer.dialogManager.confirm({
        title: 'Warning',
        msg,
        showConfirmKey,
        type: 'info',
        callback: (confirmed) => {
            const textNode = direction === 'back'
                ? editor.writer.utilities.getPreviousTextNode(range.commonAncestorContainer, true)
                : editor.writer.utilities.getNextTextNode(range.commonAncestorContainer, true);
            if (confirmed) {
                const hasTextContent = element.textContent !== '\uFEFF';
                editor.writer.tagger.removeStructureTag(element.getAttribute('id'), !hasTextContent);
            }
            if (textNode && textNode.parentNode) {
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
const moveToTextNode = (event, editor, range, direction) => {
    const textNode = direction === 'back'
        ? editor.writer.utilities.getPreviousTextNode(range.commonAncestorContainer, true)
        : editor.writer.utilities.getNextTextNode(range.commonAncestorContainer, true);
    if (textNode !== null && textNode.parentNode !== null) {
        // if parentNode is null that means the text was normalized as part of removeStructureTag
        let nextParent = textNode.parentElement;
        if (nextParent.textContent.length === 0 ||
            (nextParent.textContent.length === 1 && nextParent.textContent.charCodeAt(0) === 65279)) {
            const rng = editor.selection.getRng();
            if (direction === 'back') {
                rng.setStart(textNode, textNode.textContent.length);
                rng.setEnd(textNode, textNode.textContent.length);
            }
            else {
                rng.setStart(textNode, 0);
                rng.setEnd(textNode, 0);
            }
            deleteConfirm(editor, rng, direction);
            return cancelKey(event);
        }
        else {
            if (textNode.parentElement.nodeName === 'SPAN') {
                if (textNode.parentElement.textContent.length === 1) {
                    let nextParent = textNode.parentElement;
                    // this keydown will delete all text content, leaving an empty tag
                    // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
                    nextParent.textContent = '\uFEFF';
                    // set range to after the zwnb character
                    const rng = editor.selection.getRng();
                    rng.setStart(nextParent.firstChild, 1);
                    rng.setEnd(nextParent.firstChild, 1);
                    editor.selection.setRng(rng);
                    return cancelKey(event);
                }
            }
            else {
                const rng = editor.selection.getRng();
                if (direction === 'back') {
                    rng.setStart(textNode, textNode.textContent.length);
                    rng.setEnd(textNode, textNode.textContent.length);
                }
                else {
                    rng.setStart(textNode, 0);
                    rng.setEnd(textNode, 0);
                }
                editor.selection.setRng(rng);
                // return cancelKey(event);
            }
        }
    }
};
const preventDelete = (editor, event) => {
    const range = editor.selection.getRng();
    // deleting individual characters
    if (range.collapsed && range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
        const textContainer = range.commonAncestorContainer;
        // backspace
        if (event.code === 'Backspace') {
            // start of element
            if (range.startOffset === 0) {
                if (textContainer.textContent && textContainer.textContent.length === 0) {
                    deleteConfirm(editor, range, 'back');
                    return cancelKey(event);
                }
                else {
                    return moveToTextNode(event, editor, range, 'back');
                }
            }
            else if (range.startOffset === 1 &&
                textContainer.textContent &&
                textContainer.textContent.length === 1) {
                if (textContainer.textContent.charCodeAt(0) === 65279) {
                    if (textContainer.previousSibling === null) {
                        deleteConfirm(editor, range, 'back');
                        return cancelKey(event);
                    }
                    else {
                        return moveToTextNode(event, editor, range, 'back');
                    }
                }
                else {
                    // this keydown will delete all text content, leaving an empty tag
                    // so insert zero-width non-breaking space (zwnb) to prevent tag deletion
                    textContainer.textContent = '\uFEFF';
                    // set range to after the zwnb character
                    range.setStart(textContainer, 1);
                    editor.selection.setRng(range);
                    return cancelKey(event);
                }
            }
            else if (range.startOffset === 2 &&
                textContainer.textContent &&
                textContainer.textContent.length === 2) {
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
                }
                else {
                    return moveToTextNode(event, editor, range, 'forward');
                }
            }
            else if (range.startOffset === textContainer.length - 1 && textContainer.length === 1) {
                if (textContainer.textContent && textContainer.textContent.charCodeAt(0) === 65279) {
                    if (textContainer.nextSibling === null) {
                        deleteConfirm(editor, range, 'forward');
                        return cancelKey(event);
                    }
                    else {
                        return moveToTextNode(event, editor, range, 'forward');
                    }
                }
                else {
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
    }
    else {
        let willDeleteTags = false;
        const clone = range.cloneContents();
        if (clone.childNodes.length === 1 && clone.childNodes[0].nodeType === Node.ELEMENT_NODE) {
            willDeleteTags = true;
        }
        else {
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
            editor.writer.dialogManager.confirm({
                title: 'Warning',
                msg: '<p>The text you are trying to delete contains XML elements, do you want to proceed?</p>',
                showConfirmKey: 'confirm-delete-tags-selection',
                type: 'info',
                callback: (confirmed) => {
                    if (confirmed) {
                        editor.writer.tagger.processRemovedContent(range);
                        editor.focus();
                        if (event.code === 'Backspace' || event.code === 'Delete') {
                            editor.getDoc().execCommand('insertText', false, '');
                        }
                        else {
                            editor.getDoc().execCommand('insertText', false, event.key);
                        }
                        editor.writer.event('contentChanged').publish();
                        editor.undoManager.add();
                    }
                },
            });
            return cancelKey(event);
        }
    }
};
tinymce.PluginManager.add('preventdelete', function (editor) {
    editor.on('keydown', (event) => {
        if (keyWillDelete(event))
            preventDelete(editor, event);
    });
});
//# sourceMappingURL=prevent_delete.js.map