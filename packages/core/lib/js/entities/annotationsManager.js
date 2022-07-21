import $ from 'jquery';
import { DateTime } from 'luxon';
import { graph as RDFgraph, parse as RDFparse, serialize as RDFserialize, sym as RDFsym, } from 'rdflib';
import { log } from './../../utilities';
const leafWriterVersion = 'dev'; //webpackEnv?.LEAFWRITER_VERSION ?? '' ;
const prefixMap = new Map([
    ['bibo', 'http://purl.org/ontology/bibo/'],
    ['cnt', 'http://www.w3.org/2011/content#'],
    ['cw', 'http://cwrc.ca/ns/cw#'],
    ['dc', 'http://purl.org/dc/elements/1.1/'],
    ['dcterms', 'http://purl.org/dc/terms/'],
    ['foaf', 'http://xmlns.com/foaf/0.1/'],
    ['geo', 'http://www.w3.org/2003/01/geo/wgs84_pos#'],
    ['oa', 'http://www.w3.org/ns/oa#'],
    ['owl', 'http://www.w3.org/2002/07/owl#'],
    ['prov', 'http://www.w3.org/ns/prov#'],
    ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
    ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
    ['skos', 'http://www.w3.org/2004/02/skos/core#'],
    ['time', 'http://www.w3.org/2006/time#'],
    ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
    ['fabio', 'https://purl.org/spar/fabio#'],
    ['bf', 'http://www.openlinksw.com/schemas/bif#'],
    ['cito', 'https://sparontologies.github.io/cito/current/cito.html#'],
    ['org', 'http://www.w3.org/ns/org#'],
]);
const namespaces = new Map([
    ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
    ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
    ['as', 'http://www.w3.org/ns/activitystreams#'],
    ['cwrc', 'http://sparql.cwrc.ca/ontologies/cwrc#'],
    ['dc', 'http://purl.org/dc/elements/1.1/'],
    ['dcterms', 'http://purl.org/dc/terms/'],
    ['foaf', 'http://xmlns.com/foaf/0.1/'],
    ['geo', 'http://www.geonames.org/ontology#'],
    ['oa', 'http://www.w3.org/ns/oa#'],
    ['schema', 'http://schema.org/'],
    ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
    ['fabio', 'https://purl.org/spar/fabio#'],
    ['bf', 'http://www.openlinksw.com/schemas/bif#'],
    ['cito', 'https://sparontologies.github.io/cito/current/cito.html#'],
    ['org', 'http://www.w3.org/ns/org#'],
]);
const legacyTypes = new Map([
    ['person', 'foaf:Person'],
    ['org', 'foaf:Organization'],
    ['place', 'geo:SpatialThing'],
    ['title', 'dcterms:title'],
    ['date', 'time:TemporalEntity'],
    ['note', 'bibo:Note'],
    ['citation', 'dcterms:BibliographicResource'],
    ['correction', 'oa:editing'],
    ['keyword', 'skos:Concept'],
    ['link', 'oa:linking'],
]);
/**
 * @class AnnotationsManager
 * @param {Writer} writer
 */
class AnnotationsManager {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    getAnnotationURIForEntity(entity) {
        let createdDate = entity.getDateCreated();
        if (!createdDate)
            createdDate = new Date().toString();
        const annoIdDateString = DateTime.fromISO(createdDate).toFormat('yyyyLLddHHmmssSSS');
        const annotationId = `${entity.getType()}_annotation_${annoIdDateString}`; // github doc + entity type + datestring
        return encodeURI(annotationId);
    }
    checkAnnotationChanges = ({ docId, entity, originalData, }) => {
        if (!originalData)
            return true;
        //check if user edited annotation
        if (entity.didUpdate)
            return true;
        //check if xpath has chaged
        const range = entity.getRange();
        if (range.endXPath) {
            if (range.startXPath !==
                originalData['oa:hasTarget']['oa:hasSelector']['oa:hasStartSelector']['rdf:value'] ||
                range.endXPath !==
                    originalData['oa:hasTarget']['oa:hasSelector']['oa:hasEndSelector']['rdf:value'] ||
                range.startOffset !==
                    originalData['oa:hasTarget']['oa:hasSelector']['oa:refinedBy']['oa:start'] ||
                range.endOffset !== originalData['oa:hasTarget']['oa:hasSelector']['oa:refinedBy']['oa:end']) {
                return true;
            }
        }
        else {
            if (range.startXPath !== originalData['oa:hasTarget']['oa:hasSelector']['rdf:value']) {
                return true;
            }
        }
        //check if file will change URI (save into a different place)
        const annotantionIdKey = originalData['@id'] ? '@id' : 'id';
        if (originalData[annotantionIdKey] !== `${docId}?${this.getAnnotationURIForEntity(entity)}`) {
            return true;
        }
        return false;
    };
    /**
     * Creates a common annotation object.
     * @param {Entity} entity The entity.
     * @param {String|Array} types The annotation body type(s)
     * @param {String|Array} [motivations] The annotation motivation(s). Default is 'oa:identifying'.
     * @returns {JSON}
     */
    commonAnnotation(entity, types, motivations) {
        //retrieve original data if exists.
        const docId = this.writer.getDocumentURI();
        const originalData = entity.originalData;
        //check if any thing got modified
        const hasMutated = this.checkAnnotationChanges({ docId, entity, originalData });
        // Check if annotation mutated.
        if (originalData && !hasMutated)
            return originalData;
        if (!motivations)
            motivations = 'oa:identifying';
        // USER
        const userInfo = this.writer.getUserInfo();
        // APP
        const appURI = window.location.origin; // the URI from where LEAF-Writer is been used
        // TIME
        const createdDate = entity.getDateCreated();
        const modifiedDate = entity.getDateModified();
        // ENTITY
        const entityType = entity.getType();
        const certainty = entity.getCertainty();
        const range = entity.getRange();
        const entityId = entity.getURI();
        const annotationId = `${docId}?${this.getAnnotationURIForEntity(entity)}`;
        const creator = entity.creator
            ? entity.creator
            : {
                '@id': userInfo.id,
                '@type': ['cwrc:NaturalPerson', 'schema:Person'],
                'cwrc:hasName': userInfo.name,
                'foaf:nick': userInfo.nick,
            };
        const annotation = {
            '@context': {
                'dcterms:created': {
                    '@type': 'xsd:dateTime',
                    '@id': 'dcterms:created',
                },
                'dcterms:issued': {
                    '@type': 'xsd:dateTime',
                    '@id': 'dcterms:issued',
                },
                'oa:motivatedBy': {
                    '@type': 'oa:Motivation',
                },
                '@language': 'en',
            },
            // '@id': annotationId,
            // '@type': 'oa:Annotation',
            id: annotationId,
            type: 'oa:Annotation',
            'dcterms:created': createdDate,
            'dcterms:modified': modifiedDate,
            'dcterms:creator': creator,
            'oa:motivatedBy': motivations,
            'oa:hasTarget': {
                '@id': `${annotationId}#Target`,
                '@type': 'oa:SpecificResource',
                'oa:hasSource': {
                    '@id': docId,
                    '@type': 'dctypes:Text',
                    'dc:format': 'text/xml',
                },
                'oa:renderedVia': {
                    '@id': appURI,
                    '@type': 'as:Application',
                    'rdfs:label': 'Leaf Writer',
                    'schema:softwareVersion': leafWriterVersion,
                },
            },
            'oa:hasBody': {
                '@type': types,
            },
            'as:generator': {
                '@id': appURI,
                '@type': 'as:Application',
                'rdfs:label': 'Leaf Writer',
                'schema:url': 'https://leaf-writer.lincsproject.ca/',
                'schema:softwareVersion': leafWriterVersion,
            },
        };
        //contributors
        if (entity.didUpdate) {
            //add contributor if current user IS NEITHER the creator NOR one of the contributors
            let userIsCreator = false;
            if (entity?.creator?.['@id']) {
                userIsCreator = userInfo.id === entity?.creator?.['@id'];
            }
            else {
                userIsCreator = userInfo.id === creator['@id'];
            }
            let userIsContributor = false;
            if (annotation['dcterms:contributor']) {
                userIsContributor = !!annotation['dcterms:contributor'].find(
                //@ts-ignore
                (contributor = contributor['@id'] === userInfo.id));
            }
            if (userIsCreator === false && userIsContributor === false) {
                const contributor = {
                    'dcterms:contributor': {
                        '@id': userInfo.id,
                        '@type': ['cwrc:NaturalPerson', 'schema:Person'],
                        'cwrc:hasName': userInfo.name,
                        'foaf:nick': userInfo.nick,
                    },
                };
                if (entity?.originalData?.['dcterms:contributor']) {
                    annotation['dcterms:contributor'] = [
                        ...entity.originalData['dcterms:contributor'],
                        contributor,
                    ];
                }
                else {
                    annotation['dcterms:contributor'] = [contributor];
                }
            }
        }
        // !should add just namespaces used on this particualar annotation
        namespaces.forEach((uri, namespace) => {
            annotation['@context'][namespace] = uri;
        });
        if (entityId && entityType !== 'citation') {
            if (!Array.isArray(annotation['oa:hasBody'])) {
                annotation['oa:hasBody']['@id'] = entityId;
                annotation['oa:hasBody']['dc:format'] = 'text/plain';
            }
        }
        else if (entity.isNote()) {
            const noteEl = $(`#${entity.getId()}`, this.writer.editor?.getBody());
            const noteContent = noteEl[0].textContent ?? undefined;
            if (!Array.isArray(annotation['oa:hasBody'])) {
                annotation['oa:hasBody']['dc:format'] = 'text/plain';
                annotation['oa:hasBody']['rdf:value'] = noteContent;
            }
        }
        if (range.endXPath) {
            annotation['oa:hasTarget']['oa:hasSelector'] = {
                '@id': annotationId + '#Selector',
                '@type': 'oa:RangeSelector',
                'oa:hasStartSelector': {
                    '@type': 'oa:XPathSelector',
                    'rdf:value': range.startXPath,
                },
                'oa:hasEndSelector': {
                    '@type': 'oa:XPathSelector',
                    'rdf:value': range.endXPath,
                },
                'oa:refinedBy': {
                    '@type': 'oa:TextPositionSelector',
                    'oa:start': range.startOffset,
                    'oa:end': range.endOffset,
                },
            };
        }
        else {
            annotation['oa:hasTarget']['oa:hasSelector'] = {
                '@id': `${annotationId}#Selector`,
                '@type': 'oa:XPathSelector',
                'rdf:value': range.startXPath,
            };
        }
        if (certainty)
            annotation['cwrc:hasCertainty'] = `cwrc:${certainty}`;
        return annotation;
    }
    /**
     * Get the RDF string that represents the specified annotations.
     * @param {Array} entities An array of Entity instances
     * @param {String} format The annotation format ('xml' or 'json).
     * @returns {String} The RDF string.
     */
    async getAnnotations(entities, format = 'json') {
        const rdfStringArray = await Promise.all(entities.map((entity) => this.getAnnotationString(entity, format)));
        let rdfString = rdfStringArray.join('');
        // triples
        // for (const triple of this.writer.triples) {
        //   rdfString += `
        //     <rdf:Description
        //       rdf:about="${triple.subject.uri}"
        //       cw:external="${triple.subject.external}"
        //     >
        //       <cw:triple.predicate.name
        //         cw:text="${triple.predicate.text}"
        //         cw:external="${triple.predicate.external}"
        //       >
        //         <rdf:Description
        //           rdf:about="${triple.object.uri}"
        //           cw:external="${triple.object.external}"
        //         />
        //       </cw:triple.predicate.name>
        //     </rdf:Description>
        //   `;
        // }
        const nsAttr = [...namespaces].map(([namespace, uri]) => `xmlns:${namespace}="${uri}"`);
        return `<rdf:RDF ${nsAttr.join(' ')}>${rdfString}</rdf:RDF>`;
    }
    /**
     * Get the annotation object for the entity.
     * @param {Entity} entity The Entity instance.
     * @returns {JSON} The annotation object.
     */
    getAnnotation(entity) {
        const type = entity.getType();
        const annoMappings = this.writer.schemaManager.mapper.getMappings().entities;
        const e = annoMappings.get(type);
        if (e && e.annotation !== undefined) {
            return e.annotation(this, entity);
        }
        //  else {
        log.warn('annotationsManager.getAnnotation: no mapping found for', type);
        return undefined;
        // }
    }
    async getAnnotationString(entity, format) {
        let rdfString = '';
        const annotation = this.getAnnotation(entity);
        if (!annotation)
            return rdfString;
        if (format === 'xml') {
            const xmlAnnotation = await this.convertJSONAnnotationToXML(annotation).catch((err) => {
                log.warn('rdflib:', err);
                const message = this.writer.utilities.convertTextForExport(err.message);
                this.writer.dialogManager.show('message', {
                    title: 'LEAF-Writer Export',
                    msg: `There was an error exporting your document: ${message}`,
                    type: 'error',
                });
                return null;
            });
            $('rdf\\:Description, Description', xmlAnnotation).each((index, el) => {
                rdfString += '\n';
                rdfString += this.writer.utilities.xmlToString(el);
            });
        }
        else if (format === 'json') {
            rdfString += `
        <rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/">
          <![CDATA[${JSON.stringify(annotation, null, '\t')}]]>
        </rdf:Description>
      `;
        }
        return rdfString;
    }
    /**
     * Takes a JSON-LD formatted annotation an returns an RDF/XML version.
     * @param {JSON} annotation
     * @param {Function} callback
     * @returns {Promise}
     */
    convertJSONAnnotationToXML(annotation) {
        const _this = this;
        const docId = this.writer.getDocumentURI();
        const doc = RDFsym(docId);
        const store = RDFgraph();
        return new Promise((resolve, reject) => {
            // need to use Promise because RDFparse uses callbacks
            try {
                RDFparse(JSON.stringify(annotation), store, doc.uri, 'application/ld+json', (err, kb) => {
                    try {
                        const result = RDFserialize(doc, kb, doc.uri, 'application/rdf+xml');
                        if (result !== undefined) {
                            const xml = _this.writer.utilities.stringToXML(result);
                            resolve(xml);
                        }
                        else {
                            reject(err);
                        }
                    }
                    catch (e2) {
                        reject(e2);
                    }
                });
            }
            catch (error1) {
                reject(error1);
            }
        });
    }
    /**
     * Gets an entity config for the specified RDF element.
     * @param {Element} rdfEl An RDF element containing annotation info
     * @returns {Object|null} Entity config object
     */
    getEntityConfigFromAnnotation(rdfEl) {
        const isLegacy = rdfEl.parentElement?.hasAttribute('xmlns:cw');
        if (!isLegacy)
            return this.getEntityConfigFromJsonAnnotation(rdfEl);
        // json-ld
        if (rdfEl.getAttribute('rdf:datatype') === 'http://www.w3.org/TR/json-ld/') {
            return this.getEntityConfigFromJsonAnnotationLegacy(rdfEl);
            // rdf/xml
        }
        if (rdfEl.getAttribute('rdf:about') !== null) {
            return this.getEntityConfigFromXmlAnnotationLegacy(rdfEl);
        }
        return null;
    }
    getEntityConfigFromJsonAnnotation(rdfEl) {
        const rdf = $(rdfEl);
        const annotation = JSON.parse(rdf.text());
        if (!annotation)
            return null;
        const entityConfig = {};
        //store original data
        entityConfig.originalData = annotation;
        // type
        let annotationTypes = annotation['oa:hasBody']['type'] || annotation['oa:hasBody']['@type'];
        //@ts-ignore
        entityConfig.type = this.getEntityTypeForAnnotation(annotationTypes);
        //uri
        entityConfig.uri = annotation['oa:hasBody']['id'] || annotation['oa:hasBody']['@id'];
        // range
        entityConfig.range = {};
        const selector = annotation['oa:hasTarget']['oa:hasSelector'];
        if (selector['oa:refinedBy']) {
            entityConfig.range.startXPath = selector['oa:hasStartSelector']['rdf:value'];
            entityConfig.range.startOffset = selector['oa:refinedBy']['oa:start'];
            entityConfig.range.endXPath = selector['oa:hasEndSelector']['rdf:value'];
            entityConfig.range.endOffset = selector['oa:refinedBy']['oa:end'];
        }
        else {
            entityConfig.range.startXPath = selector['rdf:value'];
        }
        // certainty
        let certainty = annotation['cwrc:hasCertainty'] || annotation['oa:hasCertainty'];
        if (certainty) {
            certainty = certainty.split(':')[1];
            entityConfig.certainty = certainty;
        }
        // date
        entityConfig.dateCreated = annotation['dcterms:created'];
        return entityConfig;
    }
    /**
     * Parse JSON and get an Entity config object
     * @param {Element} rdfEl An RDF element containing JSON text
     * @returns {Object|null} Entity config object
     */
    getEntityConfigFromJsonAnnotationLegacy(rdfEl) {
        const rdf = $(rdfEl);
        const json = JSON.parse(rdf.text());
        if (!json)
            return null;
        const entityConfig = {};
        // entity type
        let entityType = undefined;
        let bodyTypes = json.hasBody['@type'];
        const needsMotivation = bodyTypes.indexOf('cnt:ContentAsText') !== -1;
        if (needsMotivation)
            bodyTypes = bodyTypes.concat(json.motivatedBy);
        for (let i = 0; i < bodyTypes.length; i++) {
            const typeUri = bodyTypes[i];
            entityType = this.getEntityTypeForAnnotationLegacy(typeUri);
            if (entityType !== null)
                break;
        }
        entityConfig.type = entityType;
        // range
        let rangeObj = undefined;
        const selector = json.hasTarget.hasSelector;
        if (selector['@type'] == 'oa:TextPositionSelector') {
            const xpointerStart = selector['oa:start'];
            const xpointerEnd = selector['oa:end'];
            rangeObj = this.getRangeObject(xpointerStart, xpointerEnd);
        }
        else if (selector['@type'] == 'oa:FragmentSelector') {
            const xpointer = selector['rdf:value'];
            rangeObj = this.getRangeObject(xpointer);
        }
        entityConfig.range = rangeObj;
        // lookup info
        if (json.cwrcInfo) {
            entityConfig.uri = json.cwrcInfo.uri;
            entityConfig.lemma = json.cwrcInfo.name;
        }
        // certainty
        let certainty = json.hasCertainty;
        if (certainty !== undefined) {
            certainty = certainty.split(':')[1];
            // fix for discrepancy between schemas
            if (certainty === 'reasonable')
                certainty = 'reasonably certain';
            entityConfig.certainty = certainty;
        }
        // date
        entityConfig.dateCreated = json.annotatedAt;
        return entityConfig;
    }
    /**
     * Parse XML and create a Entity config object
     * @param {Element} xml An RDF element containing XML elements
     * @returns {Object|null} Entity config object
     */
    getEntityConfigFromXmlAnnotationLegacy(xml) {
        const rdf = $(xml);
        const aboutUri = rdf.attr('rdf:about');
        if (!aboutUri || aboutUri.indexOf('id.cwrc.ca/annotation') === -1)
            return null;
        const rdfs = rdf.parent('rdf\\:RDF, RDF');
        const hasBodyUri = rdf.find('oa\\:hasBody, hasBody').attr('rdf:resource');
        const body = rdfs.find(`[rdf\\:about="${hasBodyUri}"]`);
        const hasTargetUri = rdf.find('oa\\:hasTarget, hasTarget').attr('rdf:resource');
        const target = rdfs.find(`[rdf\\:about="${hasTargetUri}"]`);
        // determine type
        let typeUri = body.children().last().attr('rdf:resource'); // FIXME relies on consistent order of rdf:type elements
        if (typeUri == null || typeUri.indexOf('ContentAsText') !== -1) {
            // body is external resource (e.g. link), or it's a generic type so must use motivation instead
            typeUri = rdf.find('oa\\:motivatedBy, motivatedBy').last().attr('rdf:resource');
        }
        if (typeUri == null) {
            log.warn("can't determine type for", xml);
            return null;
        }
        const entityConfig = {};
        const entityType = this.getEntityTypeForAnnotationLegacy(typeUri);
        if (entityType)
            entityConfig.type = entityType;
        // range
        let rangeObj = {};
        // matching element
        const selectorUri = target.find('oa\\:hasSelector, hasSelector').attr('rdf:resource');
        const selector = rdfs.find(`[rdf\\:about="${selectorUri}"]`);
        const selectorType = selector.find('rdf\\:type, type').attr('rdf:resource');
        if (selectorType?.indexOf('FragmentSelector') !== -1) {
            const xpointer = selector.find('rdf\\:value, value').text();
            rangeObj = this.getRangeObject(xpointer);
            // offset
        }
        else {
            const xpointerStart = selector.find('oa\\:start, start').text();
            const xpointerEnd = selector.find('oa\\:end, end').text();
            rangeObj = this.getRangeObject(xpointerStart, xpointerEnd);
        }
        entityConfig.range = rangeObj;
        // certainty
        let certainty = rdf.find('cw\\:hasCertainty, hasCertainty').attr('rdf:resource');
        if (certainty && certainty !== '') {
            certainty = certainty.split('#')[1];
            // fix for discrepancy between schemas
            if (certainty === 'reasonable')
                certainty = 'reasonably certain';
            entityConfig.certainty = certainty;
        }
        // lookup info
        let cwrcLookupObjString = rdf.find('cw\\:cwrcInfo, cwrcInfo').text();
        if (cwrcLookupObjString !== '') {
            const cwrcLookupObj = JSON.parse(cwrcLookupObjString);
            entityConfig.uri = cwrcLookupObj.uri;
            entityConfig.lemma = cwrcLookupObj.name;
        }
        // date created
        entityConfig.dateCreated = rdf.find('cw\\:annotatedAt, annotatedAt').text();
        return entityConfig;
    }
    /**
     * Returns the entity type, using a annotation string.
     * @param {String} annotation The annotation string, e.g. 'foaf:Person'
     * @returns {String}
     */
    getEntityTypeForAnnotationLegacy(annotation) {
        if (annotation.indexOf('http://') !== -1) {
            // convert uri to prefixed form
            for (const [namespace, uri] of prefixMap) {
                if (uri && annotation.indexOf(uri) === 0) {
                    annotation = annotation.replace(uri, `${namespace}:`);
                    break;
                }
            }
        }
        for (const [namespace, uri] of legacyTypes) {
            if (uri === annotation)
                return namespace;
        }
        return;
    }
    /**
     * Returns the entity type, using a annotation type string.
     * @param {string | string[]} annotationTypes The annotation string, e.g. 'cwrc:NaturalPerson'
     * @returns {string} EntityTypes
     */
    getEntityTypeForAnnotation(annotationTypes) {
        if (!Array.isArray(annotationTypes))
            annotationTypes = [annotationTypes];
        const entitiesMapping = this.writer.schemaManager.mapper.getEntitiesMapping();
        //test each type
        for (const annotationType of annotationTypes) {
            //on each entity
            for (const [name, mapping] of entitiesMapping.entries()) {
                const match = mapping.types?.find((type) => type === annotationType);
                if (match)
                    return name;
            }
        }
        //if not found, return an empty string
        return '';
    }
    /**
     * Gets the range object for xpointer(s).
     * @param {String} xpointerStart
     * @param {String} [xpointerEnd]
     * @return {Object}
     */
    getRangeObject(xpointerStart, xpointerEnd) {
        const xpathStart = this.parseXPointer(xpointerStart);
        const rangeObj = {
            startXPath: xpathStart.xpath,
        };
        if (xpointerEnd) {
            const xpathEnd = this.parseXPointer(xpointerEnd);
            if (xpathStart.offset)
                rangeObj.startOffset = xpathStart.offset;
            rangeObj.endXPath = xpathEnd.xpath;
            if (xpathEnd.offset)
                rangeObj.endOffset = xpathEnd.offset;
        }
        return rangeObj;
    }
    parseXPointer(xpointer) {
        let xpath;
        let offset = null;
        if (xpointer.indexOf('string-range') === -1) {
            const regex = new RegExp(/xpointer\((.*)?\)$/); // regex for isolating xpath
            const content = regex.exec(xpointer)?.[1];
            xpath = content;
        }
        else {
            const regex = new RegExp(/xpointer\((?:string-range\()?([^\)]*)\)+/); // regex for isolating xpath and offset
            const content = regex.exec(xpointer)?.[1];
            if (!content)
                return { xpath, offset };
            const parts = content.split(',');
            xpath = parts[0];
            if (parts[2])
                offset = parseInt(parts[2]);
        }
        return { xpath, offset };
    }
}
export default AnnotationsManager;
//# sourceMappingURL=annotationsManager.js.map