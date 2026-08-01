import { getNodes } from './utilities';

const taggedElement = (id: string, tag: string) => {
  const element = document.createElement('span');
  element.setAttribute('id', id);
  element.setAttribute('_tag', tag);
  return element;
};

describe('getNodes', () => {
  beforeEach(() => {
    window.writer = {
      schemaManager: { getHeader: () => 'teiHeader' },
    } as typeof window.writer;
  });

  it('assigns XPath indexes from the parent traversal', () => {
    const root = taggedElement('root', 'TEI');
    const firstParagraph = taggedElement('p-1', 'p');
    const secondParagraph = taggedElement('p-2', 'p');
    const firstName = taggedElement('name-1', 'persName');
    const secondName = taggedElement('name-2', 'persName');

    firstParagraph.append(firstName, secondName);
    root.append(firstParagraph, secondParagraph);

    const tree = getNodes({ node: root, treeType: 'tag' });

    expect(tree?.xpath).toBe('TEI');
    expect(tree?.children.map((item) => item.xpath)).toEqual(['TEI/p', 'TEI/p[2]']);
    expect(tree?.children[0]?.children.map((item) => item.xpath)).toEqual([
      'TEI/p/persName',
      'TEI/p/persName[2]',
    ]);
  });
});
