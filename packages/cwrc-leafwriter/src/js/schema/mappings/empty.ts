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
        label: 'Person',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'place',
      {
        label: 'Place',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'organization',
      {
        label: 'Organization',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'title',
      {
        label: 'Title',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'rs',
      {
        label: 'Referencing String',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],

    [
      'citation',
      {
        label: 'Citation',
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
        label: 'Note',
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
        label: 'Date',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'correction',
      {
        label: 'Corretion',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
    [
      'keyword',
      {
        label: 'Keyword',
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
        label: 'Link',
        mapping: {},
        parentTag: '',
        mappingFunction: (entity) => [''],
        annotation: (annotationsManager, entity, format) => {},
      },
    ],
  ]),
};

export default empty;
