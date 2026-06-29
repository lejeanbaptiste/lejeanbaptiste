Yes — the likely bug is **selection-direction asymmetry**.

When moving left, the browser does **not** represent the caret as “the end of the previous text node.” It often represents it as:

```js
textAfterTag, offset 0
```

or:

```js
parentElement, childOffset just after the tagNode
```

So if your ArrowRight logic checks “next sibling/tag after caret,” the mirror logic for ArrowLeft must check **previous sibling/tag before caret**, especially when `offset === 0`.

The fix pattern should be:

```js
if (event.key === 'ArrowRight') {
  if (selectedTag) {
    moveCaretAfterTag(selectedTag)
    clearSelectedTag()
    event.preventDefault()
    return
  }

  const tag = getTagImmediatelyAfterCaret()
  if (tag) {
    selectTag(tag)
    event.preventDefault()
    return
  }
}

if (event.key === 'ArrowLeft') {
  if (selectedTag) {
    moveCaretBeforeTag(selectedTag)
    clearSelectedTag()
    event.preventDefault()
    return
  }

  const tag = getTagImmediatelyBeforeCaret()
  if (tag) {
    selectTag(tag)
    event.preventDefault()
    return
  }
}
```

The important missing function is probably this:

```js
function getTagImmediatelyBeforeCaret() {
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed) return null

  const node = sel.anchorNode
  const offset = sel.anchorOffset

  // Case 1: caret is inside a text node, at its beginning:
  // <tag-widget></tag-widget>|text
  if (node.nodeType === Node.TEXT_NODE && offset === 0) {
    return findPreviousTagWidget(node)
  }

  // Case 2: caret is in an element, child offset after tag:
  // parent.childNodes[offset - 1] is the tag widget
  if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const prev = node.childNodes[offset - 1]
    return isTagWidget(prev) ? prev : findPreviousTagWidget(prev)
  }

  return null
}
```

And the rightward version should be the true mirror:

```js
function getTagImmediatelyAfterCaret() {
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed) return null

  const node = sel.anchorNode
  const offset = sel.anchorOffset

  if (node.nodeType === Node.TEXT_NODE && offset === node.nodeValue.length) {
    return findNextTagWidget(node)
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const next = node.childNodes[offset]
    return isTagWidget(next) ? next : findNextTagWidget(next)
  }

  return null
}
```

The conceptual model should be:

```text
text position before tag
↓ ArrowRight
tag selected
↓ ArrowRight
text position after tag

text position after tag
↓ ArrowLeft
tag selected
↓ ArrowLeft
text position before tag
```

I would also handle this on **keydown**, not keyup. If you wait until keyup, the browser may already have skipped over the non-editable tag widget, especially moving left.

To debug quickly, add this inside your arrow handler:

```js
const sel = window.getSelection()
console.log({
  key: event.key,
  anchorNode: sel.anchorNode,
  anchorOffset: sel.anchorOffset,
  parent: sel.anchorNode?.parentNode,
})
```

Then compare ArrowRight-before-tag vs ArrowLeft-after-tag. I strongly suspect ArrowLeft is landing at `offset === 0` in the text node after the tag, and your current code is not treating that as “tag immediately before caret.”
