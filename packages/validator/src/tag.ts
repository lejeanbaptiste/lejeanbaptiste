import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/unionBy';
import { EventSet } from 'salve-annos/build/dist';
import { Tag } from './sharedTypes';
import { evaluateXPath, getFullNameFromDocumentation } from './utils';
import { virtualEditor } from './virtualEditor';

export interface TagRequest {
  tagName: string;
  parentXpath: string;
  index: number;
}

export interface TagAttribute {
  name: string;
  ns?: string;
  fullName?: string;
  documentation?: string;
}

export const tagAt = async ({
  tagName,
  parentXpath,
  index,
}: TagRequest): Promise<Tag | undefined> => {
  console.groupCollapsed(`tagAt: ${tagName} on ${parentXpath}`);
  console.time('Timer');

  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');
  if (!virtualEditor.validator) throw new Error('virtualEditor: Validator not set');

  const container = evaluateXPath(parentXpath, virtualEditor.document);
  const possibleAt: EventSet = virtualEditor.validator.possibleAt(container, index);

  let tag: Tag | undefined = undefined;

  Array.from(possibleAt).forEach((event) => {
    if (event.name !== 'enterStartTag') return;
    if ('name' in event.namePattern) {
      if (event.namePattern.name === tagName) {
        const { name, documentation, ns } = event.namePattern;
        const fullName = documentation ? getFullNameFromDocumentation(documentation) : undefined;
        tag = { name, documentation, ns, fullName };
        return;
      }
    }
  });

  console.timeEnd('Timer');
  console.groupEnd();

  return tag;
};

export const attributesForTag = async (
  xpath: string,
  index: number = 1
): Promise<TagAttribute[]> => {
  console.groupCollapsed(`attributesForTag: ${xpath}`);
  console.time('Timer');

  if (!virtualEditor.document) throw new Error('virtualEditor: Document not set');
  if (!virtualEditor.validator) throw new Error('virtualEditor: Validator not set');

  const container = evaluateXPath(xpath, virtualEditor.document);
  const possibleAt: EventSet = virtualEditor.validator.possibleAt(container, index, true);

  let atttibutes: TagAttribute[] = [];

  Array.from(possibleAt).forEach((event) => {
    if ('namePattern' in event && 'name' in event.namePattern) {
      const { name, ns, documentation } = event.namePattern;
      const fullName = documentation ? getFullNameFromDocumentation(documentation) : undefined;
      atttibutes.push({ name, ns, fullName, documentation });
    }
  });

  atttibutes = uniqBy(atttibutes, 'name');
  atttibutes = sortBy(atttibutes, ['name']);

  console.timeEnd('Timer');
  console.groupEnd();

  return atttibutes;
};
