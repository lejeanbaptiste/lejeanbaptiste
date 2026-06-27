const XPATH_HIT_CLASS = 'lw-xpath-hit';
const STYLE_ELEMENT_ID = 'lw-xpath-highlight-styles';

const ensureHighlightStyles = (doc: Document) => {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .${XPATH_HIT_CLASS} {
      outline: 2px solid #42a5f5;
      outline-offset: 2px;
      background-color: rgba(66, 165, 245, 0.12);
    }
  `;
  doc.head.appendChild(style);
};

export const clearXPathHighlights = () => {
  const body = window.writer?.editor?.getBody();
  if (!body) return;

  body.querySelectorAll(`.${XPATH_HIT_CLASS}`).forEach((element) => {
    element.classList.remove(XPATH_HIT_CLASS);
  });
};

export const applyXPathHighlight = (element: Element): void => {
  const editor = window.writer?.editor;
  const body = editor?.getBody();
  if (!editor || !body || !body.contains(element)) return;

  clearXPathHighlights();
  ensureHighlightStyles(editor.getDoc());
  element.classList.add(XPATH_HIT_CLASS);
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
};
