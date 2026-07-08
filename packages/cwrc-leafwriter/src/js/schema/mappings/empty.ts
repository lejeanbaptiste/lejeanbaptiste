import type { SchemaMappingProps } from '../types';

export const empty: SchemaMappingProps = {
  blockElements: [],
  header: '',
  headings: [],
  id: '',
  listeners: {
    tagAdded: (_tag: any) => {},
    tagEdited: (_tag: any) => {},
    documentLoaded: (_success: any, _body: any) => {},
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
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'place',
      {
        label: 'Place',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'organization',
      {
        label: 'Organization',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'work',
      {
        label: 'Work',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'thing',
      {
        label: 'Thing',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],

    [
      'citation',
      {
        label: 'Citation',
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
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
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'date',
      {
        label: 'Date',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'correction',
      {
        label: 'Corretion',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'keyword',
      {
        label: 'Keyword',
        mapping: {},
        parentTag: '',
        textTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
    [
      'link',
      {
        label: 'Link',
        mapping: {},
        parentTag: '',
        mappingFunction: (_entity: any) => [''],
        annotation: (_annotationsManager: any, _entity: any, _format: any) => {},
      },
    ],
  ]),
};

export default empty;
