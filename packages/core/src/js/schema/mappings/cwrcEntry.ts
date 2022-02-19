import $ from 'jquery';
import type { IEntityMapping, ISchemaMapping } from '../types';
import { handleGraphics } from './utitlities';

const person: IEntityMapping = {
  label: 'Person',
  mapping: {
    lemma: '@STANDARD',
    uri: '@REF',
  },
  parentTag: 'NAME',
  types: ['foaf:Person'],
  annotation: (annotationsManager, entity, format) => {
    return annotationsManager.commonAnnotation(entity, 'foaf:Person');
  },
};

const place: IEntityMapping = {
  label: 'Place',
  mapping: {
    lemma: '@REG',
    uri: '@REF',
  },
  parentTag: 'PLACE',
  types: ['geo:SpatialThing'],
  annotation: (annotationsManager, entity, format) => {
    return annotationsManager.commonAnnotation(entity, 'geo:SpatialThing');
  },
};

const organization: IEntityMapping = {
  label: 'Organization',
  mapping: {
    lemma: '@REG',
    uri: '@REF',
  },
  parentTag: 'ORGNAME',
  types: ['foaf:Organization'],
  annotation: (annotationsManager, entity, format) => {
    return annotationsManager.commonAnnotation(entity, 'foaf:Organization');
  },
};

const title: IEntityMapping = {
  label: 'Title',
  mapping: {
    lemma: '@REG',
    uri: '@REF',
  },
  parentTag: 'TITLE',
  types: ['dcterms:BibliographicResource', 'dcterms:title'],
  annotation: (annotationsManager, entity, format) => {
    const anno = annotationsManager.commonAnnotation(
      entity,
      ['dcterms:BibliographicResource', 'dcterms:title'],
      'oa:identifying'
    );

    if (format === 'xml') {
      const titleType = entity.getAttribute('TITLETYPE');
      const levelXml = $.parseXML(
        `<cw:pubType xmlns:cw="http://cwrc.ca/ns/cw#">${titleType}</cw:pubType>`
      );
      const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
      body.prepend(levelXml.firstChild);
    } else {
      if (!Array.isArray(anno['oa:hasBody'])) {
        anno['oa:hasBody']['pubType'] = entity.getAttribute('TITLETYPE');
      }
    }

    return anno;
  },
};

const citation: IEntityMapping = {
  isNote: true,
  label: 'Citation',
  mapping: {
    noteContent: '.',
    uri: '@REF',
  },
  parentTag: 'BIBCIT',
  types: ['dcterms:BibliographicResource'],
  annotation: (annotationsManager, entity, format) => {
    return annotationsManager.commonAnnotation(
      entity,
      'dcterms:BibliographicResource',
      'cw:citing'
    );
  },
};

const note: IEntityMapping = {
  isNote: true,
  label: 'Note',
  mapping: {
    noteContent: '.',
    tag: 'local-name(.)',
  },
  parentTag: ['RESEARCHNOTE', 'SCHOLARNOTE'],
  xpathSelector: 'self::cwrcEntry:RESEARCHNOTE|self::cwrcEntry:SCHOLARNOTE',
  types: ['bibo:Note'],
  annotation: (annotationsManager, entity) => {
    return annotationsManager.commonAnnotation(entity, 'bibo:Note', 'oa:commenting');
  },
};

const date: IEntityMapping = {
  label: 'Date',
  mapping: {
    tag: 'local-name(.)',
  },
  parentTag: ['DATE', 'DATERANGE'],
  types: ['time:Interval', 'time:Instant', 'time:TemporalEntity'],
  xpathSelector: 'self::cwrcEntry:DATE|self::cwrcEntry:DATERANGE',
  annotation: (annotationsManager, entity, format) => {
    const types: string[] = [];
    entity.getAttribute('FROM') ? types.push('time:Interval') : types.push('time:Instant');
    types.push('time:TemporalEntity');

    const anno = annotationsManager.commonAnnotation(entity, types);

    if (format === 'xml') {
      let dateXml;
      if (entity.getAttribute('VALUE') !== undefined) {
        const valueAttr = entity.getAttribute('VALUE');
        dateXml = $.parseXML(
          `<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">${valueAttr}</xsd:date>`
        );
      } else {
        // TODO properly encode date range
        const fromAttr = entity.getAttribute('FROM');
        const toAttr = entity.getAttribute('TO');
        dateXml = $.parseXML(
          `<xsd:date xmlns:xsd="http://www.w3.org/2001/XMLSchema#">${fromAttr}/${toAttr}</xsd:date>`
        );
      }
      const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
      body.prepend(dateXml.firstChild);
    } else {
      if (entity.getAttribute('VALUE')) {
        if (!Array.isArray(anno['oa:hasBody'])) {
          anno['oa:hasBody']['xsd:date'] = entity.getAttribute('VALUE');
        }
      } else {
        if (!Array.isArray(anno['oa:hasBody'])) {
          const fromAttr = entity.getAttribute('FROM');
          const toAttr = entity.getAttribute('TO');
          anno['oa:hasBody']['xsd:date'] = `${fromAttr}/${toAttr}`;
        }
      }
    }

    return anno;
  },
};

const correction: IEntityMapping = {
  label: 'Correction',
  parentTag: 'SIC',
  types: ['cnt:ContentAsText'],
  annotation: (annotationsManager, entity, format) => {
    const anno = annotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:editing');

    if (format === 'xml') {
      const corrAttr = entity.getAttribute('CORR');
      const corrXml = $.parseXML(
        `<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">${corrAttr}</cnt:chars>`
      );
      const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
      body.prepend(corrXml.firstChild);
    } else {
      if (!Array.isArray(anno['oa:hasBody'])) {
        anno['oa:hasBody']['cnt:chars'] = entity.getAttribute('CORR');
      }
    }

    return anno;
  },
};

const keyword: IEntityMapping = {
  isNote: true,
  label: 'Keyword',
  parentTag: 'KEYWORDCLASS',
  types: ['oa:Tag', 'cnt:ContentAsText', 'skos:Concept'],
  annotation: (annotationsManager, entity, format) => {
    const anno = annotationsManager.commonAnnotation(
      entity,
      ['oa:Tag', 'cnt:ContentAsText', 'skos:Concept'],
      'oa:classifying'
    );

    const keyword = entity.getAttribute('KEYWORDTYPE');
    if (format === 'xml') {
      const body = $(`[rdf\\:about="${entity.getUris().entityId}"]`, anno);
      const keywordXml = $.parseXML(
        `<cnt:chars xmlns:cnt="http://www.w3.org/2011/content#">${keyword}</cnt:chars>`
      );
      body.prepend(keywordXml.firstChild);
    } else {
      if (!Array.isArray(anno['oa:hasBody'])) {
        anno['oa:hasBody']['cnt:chars'] = keyword;
      }
    }

    return anno;
  },
};

const link: IEntityMapping = {
  label: 'Link',
  parentTag: 'XREF',
  types: ['cnt:ContentAsText'],
  annotation: (annotationsManager, entity, format) => {
    return annotationsManager.commonAnnotation(entity, 'cnt:ContentAsText', 'oa:linking');
  },
};

export const cwrcEntry: ISchemaMapping = {
  blockElements: [],
  header: 'CWRCHEADER',
  id: 'xml:id',
  responsibility: 'RESP',
  rdfParentSelector: '/CWRC/CWRCHEADER',
  root: ['CWRC'],
  urlAttributes: ['URL', 'REF'],
  entities: new Map([
    ['person', person],
    ['place', place],
    ['organization', organization],
    ['title', title],
    ['citation', citation],
    ['note', note],
    ['date', date],
    ['correction', correction],
    ['keyword', keyword],
    ['link', link],
  ]),
  listeners: {
    tagAdded: (tag) => {
      const $tag = $(tag);
      if ($tag.attr('_tag') === 'GRAPHIC') handleGraphics($tag);
    },
    tagEdited: (tag) => {
      const $tag = $(tag);
      if ($tag.attr('_tag') === 'GRAPHIC') handleGraphics($tag);
    },
    documentLoaded: (success, body) => {
      $(body)
        .find('*[_tag="GRAPHIC"]')
        .each((index, element) => handleGraphics($(element)));
    },
  },
};

export default cwrcEntry;
