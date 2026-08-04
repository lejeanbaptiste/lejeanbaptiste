/**
 * Pure-DOM helpers for translation-pane footnote structure.
 * Kept next to TranslationPane; imported by tests and (via duplicate keep-in-sync
 * risk) mirrored in TranslationPane — prefer importing from here if we later
 * split the pane. For now TranslationPane inlines the same logic; this file
 * documents and tests the contract.
 */
export const FN_MARK_ATTR = 'data-leaf-fn-mark';
export const FN_BODY_ATTR = 'data-leaf-fn-body';

export const footnoteBodyOf = (note: Element): HTMLElement | null =>
  note.querySelector(`:scope > [${FN_BODY_ATTR}]`);

export const footnoteBodyHtml = (note: Element): string => {
  const body = footnoteBodyOf(note);
  if (body) return body.innerHTML;
  const clone = note.cloneNode(true) as Element;
  for (const mark of Array.from(clone.querySelectorAll(`[${FN_MARK_ATTR}]`))) mark.remove();
  return clone.innerHTML;
};

export const normalizeFootnoteNotes = (editable: HTMLElement): void => {
  const notes = Array.from(editable.querySelectorAll('note'));
  notes.forEach((note, index) => {
    note.setAttribute('contenteditable', 'false');
    if (!note.getAttribute('place')) note.setAttribute('place', 'foot');

    let mark = note.querySelector(`:scope > [${FN_MARK_ATTR}]`) as HTMLElement | null;
    let body = footnoteBodyOf(note);

    if (!body) {
      body = document.createElement('span');
      body.setAttribute(FN_BODY_ATTR, 'true');
      const move = Array.from(note.childNodes).filter(
        (child) =>
          !(child.nodeType === Node.ELEMENT_NODE && (child as Element).hasAttribute(FN_MARK_ATTR)),
      );
      for (const child of move) body.appendChild(child);
      note.appendChild(body);
    }

    if (!mark) {
      mark = document.createElement('span');
      mark.setAttribute(FN_MARK_ATTR, 'true');
      mark.setAttribute('contenteditable', 'false');
      note.insertBefore(mark, body);
    } else if (mark.nextSibling !== body) {
      note.insertBefore(mark, body);
    }
    mark.textContent = String(index + 1);
  });
};

export const flattenFootnoteNotesForPersist = (root: ParentNode): void => {
  const host = root as ParentNode & {
    querySelectorAll?: typeof Element.prototype.querySelectorAll;
  };
  if (!host.querySelectorAll) return;
  for (const note of Array.from(host.querySelectorAll('note'))) {
    const body = footnoteBodyOf(note);
    if (body) {
      note.innerHTML = body.innerHTML;
    } else {
      for (const mark of Array.from(note.querySelectorAll(`[${FN_MARK_ATTR}]`))) mark.remove();
    }
    note.removeAttribute('contenteditable');
  }
};
