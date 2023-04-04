import type { Resource } from '@src/types';
import axios from 'axios';
import { handleAxiosError } from '../utilities';

export const api = {
  /**
   * Get a colleciton of document: either template or sample files
   * @param {string} collection - string - The name of the collection you want to load.
   * @returns An array of Resource objects.
   */
  async loadCollection(collection: string) {
    const { data } = await axios.get<Resource[]>(`./content/${collection}.json`);
    return data;
  },

  /**
   * Get a sample document: either a template or a sample file
   * @param {string} url - The URL of the sample to load.
   * @returns The data property of the response object.
   */
  async loadSample(url: string) {
    const { data } = await axios.get<string>(url);
    return data;
  },

  /**
   * It saves a value to local storage, but if the value is not a string, it converts it to a string
   * before saving it
   * @param {string} key - string - The key to save the value under.
   * @param {unknown} value - The value to be stored in local storage.
   */
  saveToLocalStorage<T = unknown>(key: string, value: T) {
    const stringfiedValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringfiedValue);
  },

  /**
   * It gets a value from local storage, and if it's a JSON string, it parses it into an object
   * @param {string} key - The key to store the value under.
   * @returns The value of the key in localStorage.
   */
  getFromLocalStorage<T = string>(key: string): T | null {
    const value = localStorage.getItem(key);
    if (!value) return null;

    try {
      const object = JSON.parse(value);
      return object as T;
    } catch (error) {
      return value as T;
    }
  },

  /**
   * It removes a key from local storage
   * @param {string} key - The key to be used to store the data in local storage.
   */
  removeFromLocalStorage(key: string) {
    localStorage.removeItem(key);
  },

   /**
   * It deletes all keys from local storage
   */
   clearLocalStorage() {
    localStorage.clear();
  },
  
  /**
   * It send the document to a external service to convert from XML to HTML
   * @param {string} content - The stringify XML
   * @returns The stringify HTML or an error
   */
  async convertXMLtoHTML(content: string): Promise<string | Error> {
    //* MOCK UP
    return new Promise((resolve) => {
      setTimeout(() => {
        if (true) {
          resolve('<html><head></head><body>text</body></html>');
          return;
        }
        // resolve(handleAxiosError({ message: 'error 404' }));
      }, 2000);
    });

    try {
      const { data } = await axios.post<string>('URL', { document: content });
      return data;
    } catch (error) {
      return handleAxiosError(error);
    }
  },

  /**
   * It send a transkribus-TEI document to a external service to convert to TEI
   * @param {string} content - The stringify XML
   * @returns The stringify XML or an error
   */
  async convertTranskribusToTei(content: string): Promise<string | Error> {
    //* MOCK UP
    return new Promise((resolve) => {
      setTimeout(() => {
        if (true) {
          resolve(mockTranskribusToTeiResults);
          return;
        }
        resolve(handleAxiosError({ message: 'error 404' }));
      }, 2000);
    });

    try {
      const { data } = await axios.post<string>('URL', { document: content });
      return data;
    } catch (error) {
      return handleAxiosError(error);
    }
  },
};

const mockTranskribusToTeiResults = `<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
	
	
	
<teiHeader>
  <fileDesc>
    <titleStmt>
      <title>Political Meeting</title>
      <author>A. M. Klein</author>
      <respStmt>
        <name role="editor">Zailig Pollock</name>
        <resp/>
      </respStmt>
    </titleStmt>
    <publicationStmt>
      <p/>
    </publicationStmt>
    <sourceDesc>
      <p>This sample poem is based on the version in the Complete Poems of A. M. Klein, ed. Zailig Pollock (Toronto: U of Toronto Press, 1990)</p>
    </sourceDesc>
  </fileDesc>
  <xenoData><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:as="http://www.w3.org/ns/activitystreams#" xmlns:cwrc="http://sparql.cwrc.ca/ontologies/cwrc#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:foaf="http://xmlns.com/foaf/0.1/" xmlns:geo="http://www.geonames.org/ontology#" xmlns:oa="http://www.w3.org/ns/oa#" xmlns:schema="http://schema.org/" xmlns:xsd="http://www.w3.org/2001/XMLSchema#" xmlns:fabio="https://purl.org/spar/fabio#" xmlns:bf="http://www.openlinksw.com/schemas/bif#" xmlns:cito="https://sparontologies.github.io/cito/current/cito.html#" xmlns:org="http://www.w3.org/ns/org#">
      <rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/">
        <![CDATA[{
"@context": {
  "dcterms:created": {
    "@type": "xsd:dateTime",
    "@id": "dcterms:created"
  },
  "dcterms:issued": {
    "@type": "xsd:dateTime",
    "@id": "dcterms:issued"
  },
  "oa:motivatedBy": {
    "@type": "oa:Motivation"
  },
  "@language": "en",
  "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
  "as": "http://www.w3.org/ns/activitystreams#",
  "cwrc": "http://sparql.cwrc.ca/ontologies/cwrc#",
  "dc": "http://purl.org/dc/elements/1.1/",
  "dcterms": "http://purl.org/dc/terms/",
  "foaf": "http://xmlns.com/foaf/0.1/",
  "geo": "http://www.geonames.org/ontology#",
  "oa": "http://www.w3.org/ns/oa#",
  "schema": "http://schema.org/",
  "xsd": "http://www.w3.org/2001/XMLSchema#"
},
"@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml?person_annotation_20200814185344866",
"@type": "oa:Annotation",
"dcterms:created": "2020-08-14T22:53:44.866Z",
"dcterms:issued": "2020-08-14T22:58:12.700Z",
"dcterms:creator": {
  "@id": "https://github.com/spedraca",
  "@type": [
    "cwrc:NaturalPerson",
    "schema:Person"
  ],
  "cwrc:hasName": "Samia Pedraça",
  "foaf:nick": "spedraca"
},
"oa:motivatedBy": "oa:identifying",
"oa:hasTarget": {
  "@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml?person_annotation_20200814185344866#Target",
  "@type": "oa:SpecificResource",
  "oa:hasSource": {
    "@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml",
    "@type": "dctypes:Text",
    "dc:format": "text/xml"
  },
  "oa:renderedVia": {
    "@id": "https://cwrc-writer.cwrc.ca/",
    "@type": "as:Application",
    "rdfs:label": "CWRC Writer",
    "schema:softwareVersion": "1.0"
  },
  "oa:hasSelector": {
    "@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml?person_annotation_20200814185344866#Selector",
    "@type": "oa:XPathSelector",
    "rdf:value": "TEI/text/body/div/head/persName"
  }
},
"oa:hasBody": {
  "@type": "cwrc:NaturalPerson",
  "@id": "42172560",
  "dc:format": "text/plain"
},
"as:generator": {
  "@id": "https://cwrc-writer.cwrc.ca/",
  "@type": "as:Application",
  "rdfs:label": "CWRC Writer",
  "schema:url": "https://cwrc-writer.cwrc.ca",
  "schema:softwareVersion": "1.0"
},
"oa:hasCertainty": "cwrc:medium"
}]]>
      </rdf:Description>
    
      <rdf:Description rdf:datatype="http://www.w3.org/TR/json-ld/">
        <![CDATA[{
"@context": {
  "dcterms:created": {
    "@type": "xsd:dateTime",
    "@id": "dcterms:created"
  },
  "dcterms:issued": {
    "@type": "xsd:dateTime",
    "@id": "dcterms:issued"
  },
  "oa:motivatedBy": {
    "@type": "oa:Motivation"
  },
  "@language": "en",
  "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
  "as": "http://www.w3.org/ns/activitystreams#",
  "cwrc": "http://sparql.cwrc.ca/ontologies/cwrc#",
  "dc": "http://purl.org/dc/elements/1.1/",
  "dcterms": "http://purl.org/dc/terms/",
  "foaf": "http://xmlns.com/foaf/0.1/",
  "geo": "http://www.geonames.org/ontology#",
  "oa": "http://www.w3.org/ns/oa#",
  "schema": "http://schema.org/",
  "xsd": "http://www.w3.org/2001/XMLSchema#"
},
"@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml?person_annotation_20200814185344869",
"@type": "oa:Annotation",
"dcterms:created": "2020-08-14T22:53:44.869Z",
"dcterms:issued": "2020-08-14T22:58:12.707Z",
"dcterms:creator": {
  "@id": "https://github.com/spedraca",
  "@type": [
    "cwrc:NaturalPerson",
    "schema:Person"
  ],
  "cwrc:hasName": "Samia Pedraça",
  "foaf:nick": "spedraca"
},
"oa:motivatedBy": "oa:identifying",
"oa:hasTarget": {
  "@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml?person_annotation_20200814185344869#Target",
  "@type": "oa:SpecificResource",
  "oa:hasSource": {
    "@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml",
    "@type": "dctypes:Text",
    "dc:format": "text/xml"
  },
  "oa:renderedVia": {
    "@id": "https://cwrc-writer.cwrc.ca/",
    "@type": "as:Application",
    "rdfs:label": "CWRC Writer",
    "schema:softwareVersion": "1.0"
  },
  "oa:hasSelector": {
    "@id": "https://raw.githubusercontent.com/spedraca/misc-misc/master/poem.xml?person_annotation_20200814185344869#Selector",
    "@type": "oa:XPathSelector",
    "rdf:value": "TEI/text/body/div/docAuthor/persName"
  }
},
"oa:hasBody": {
  "@type": "cwrc:NaturalPerson",
  "@id": "http://viaf.org/viaf/110146998373218941066/",
  "dc:format": "text/plain"
},
"as:generator": {
  "@id": "https://cwrc-writer.cwrc.ca/",
  "@type": "as:Application",
  "rdfs:label": "CWRC Writer",
  "schema:url": "https://cwrc-writer.cwrc.ca",
  "schema:softwareVersion": "1.0"
},
"oa:hasCertainty": "cwrc:high"
}]]>
      </rdf:Description>
    </rdf:RDF></xenoData></teiHeader>
<text>
  <body>
    <div type="poem" subtype="terzarima">
      <head type="poem">Political Meeting (For <persName cert="medium" ref="42172560">Camillien Houde</persName>)</head>
      <docAuthor>by <persName ref="http://viaf.org/viaf/110146998373218941066/" cert="high" type="real">A.M. Klein</persName></docAuthor>
      <lg>
        <l>On the school platform, draping the folding seats,</l><l>they wait the chairman's praise and glass of water.</l><l>Upon the wall the agonized Y initials their faith.</l>
      </lg>
      <lg>
        <l>Here all are laic; the skirted brothers have gone.</l><l>Still, their equivocal absence is felt, like a breeze</l><l>that gives curtains the sounds of surplices.</l>
      </lg>
      <lg>
        <l>The hall is yellow with light, and jocular;</l><l>suddenly some one lets loose upon the air</l><l>the ritual bird which the crowd in snares of singing</l>
      </lg>
      <lg>
        <l>catches and plucks, throat, wings, and little limbs.</l><l>Fall the feathers of sound, like <foreign>alouette</foreign>'s.</l><l>The chairman, now, is charming, full of asides and wit,</l>
      </lg>
      <lg>
        <l>building his orators, and chipping off</l><l>the heckling gargoyles popping in the hall.</l><l>(Outside, in the dark, the street is body-tall,</l>
      </lg>
      <lg>
        <l>flowered with faces intent on the scarecrow thing</l><l>that shouts to thousands the echoing</l><l>of their own wishes.) The Orator has risen!</l>
      </lg>
      <lg>
        <l>Worshipped and loved, their favourite visitor,</l><l>a country uncle with sunflower seeds in his pockets,</l><l>full of wonderful moods, tricks, imitative talk,</l>
      </lg>
      <lg>
        <l>he is their idol: like themselves, not handsome,</l><l>not snobbish, not of the <foreign>Grande Allée! Un homme!</foreign>
        </l><l>Intimate, informal, he makes bear's compliments</l>
      </lg>
      <lg>
        <l>to the ladies; is gallant; and grins;</l><l>goes for the balloon, his opposition, with pins;</l><l>jokes also on himself, speaks of himself</l>
      </lg>
      <lg>
        <l>in the third person, slings slang, and winks with folklore;</l><l>and knows now that he has them, kith and kin.</l><l>Calmly, therefore, he begins to speak of war,</l>
      </lg>
      <lg>
        <l>praises the virtue of being <foreign>Canadien</foreign>,</l><l>of being at peace, of faith, of family,</l><l>and suddenly his other voice: <emph>Where are your sons?</emph>
        </l>
      </lg>
      <lg>
        <l>He is tearful, choking tears; but not he</l><l>would blame the clever English; in their place</l><l>he'd do the same; maybe.</l>
      </lg>
      <lg>
        <l part="I">Where <emph>are</emph> your sons?</l><l part="F">The whole street wears one face,</l><l>shadowed and grim; and in the darkness rises</l><l>the body-odour of race.</l>
      </lg>
    </div>
  </body>
</text>
</TEI>`
