import type { SchemaMappingProps } from '../types';

export const empty: SchemaMappingProps = {
  blockElements: [],
  header: '',
  headings: [],
  id: '',
  listeners: {
    tagAdded: (tag) => {},
    tagEdited: (tag) => {},
    documentLoaded: (success, body) => {},
  },
  namespace: '',
  responsibility: '',
  rdfParentSelector: '',
  root: [],
  urlAttributes: [],

  entities: new Map([
    [
      'person',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'place',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'organization',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'title',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'rs',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],

    [
      'citation',
      {
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'note',
      {
        isNote: true,
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'date',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'correction',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'keyword',
      {
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'link',
      {
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
  ]),
};

export default empty;
