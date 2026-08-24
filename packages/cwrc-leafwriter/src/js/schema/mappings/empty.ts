import type { SchemaMappingProps } from '../types';

export const empty: SchemaMappingProps = {
  blockElements: [],
  header: '',
  headings: [],
  id: '',
  listeners: {
    tagAdded: (_tag) => {},
    tagEdited: (_tag) => {},
    documentLoaded: (_success, _body) => {},
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
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'place',
      {
        label: 'Place',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'organization',
      {
        label: 'Organization',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'work',
      {
        label: 'Work',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'thing',
      {
        label: 'Thing',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],

    [
      'citation',
      {
        label: 'Citation',
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
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
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'date',
      {
        label: 'Date',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'correction',
      {
        label: 'Corretion',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'keyword',
      {
        label: 'Keyword',
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
    [
      'link',
      {
        label: 'Link',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity) => [''],
        annotation: (_annotationsManager, _entity, _format) => {},
      },
    ],
  ]),
};

export default empty;
