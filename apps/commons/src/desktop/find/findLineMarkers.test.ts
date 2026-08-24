import { FIND_LINE_ACTIVE_CLASS, FIND_LINE_CLASS, getWysiwygLineBlock } from './findLineMarkers';

describe('findLineMarkers', () => {
  it('finds the direct child block of the editor body', () => {
    const body = document.createElement('div');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('hello');
    paragraph.appendChild(text);
    body.appendChild(paragraph);

    expect(getWysiwygLineBlock(text, body)).toBe(paragraph);
  });

  it('walks up through inline markup to the containing block', () => {
    const body = document.createElement('div');
    const paragraph = document.createElement('p');
    const emphasis = document.createElement('em');
    const text = document.createTextNode('hello');
    emphasis.appendChild(text);
    paragraph.appendChild(emphasis);
    body.appendChild(paragraph);

    expect(getWysiwygLineBlock(text, body)).toBe(paragraph);
  });

  it('exports distinct class names for all hits vs the active line', () => {
    expect(FIND_LINE_CLASS).not.toBe(FIND_LINE_ACTIVE_CLASS);
  });
});
