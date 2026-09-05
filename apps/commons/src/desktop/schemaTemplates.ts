import type { ProjectFileConfig } from './projectTypes';

interface SchemaTemplateConfig {
  schema?: {
    catalogId?: ProjectFileConfig['schema'] extends { catalogId?: infer C } ? C : string;
    css?: string;
    rng?: string;
  };
}

const xmlModelPi = (rng: string) =>
  `<?xml-model href="${rng}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>`;

const stylesheetPi = (css: string) => `<?xml-stylesheet type="text/css" href="${css}"?>`;

/** TEI skeleton — shared for teiAll, teiLite, and teiSimplePrint. */
export const buildTeiSkeletonXml = (config: SchemaTemplateConfig): string => {
  const rng = config.schema?.rng ?? 'schema/tei_lite.rng';
  const css = config.schema?.css ?? 'schema/tei.css';

  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlModelPi(rng)}
${stylesheetPi(css)}
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><publisher/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
</teiHeader>
<text>
  <body>
    <div type="text">
      <head>Section heading</head>
      <p>Paragraph text</p>
    </div>
  </body>
</text>
</TEI>`;
};

/** jTEI article skeleton — front (abstract), body, back (bibliography). */
export const buildJTeiSkeletonXml = (config: SchemaTemplateConfig): string => {
  const rng = config.schema?.rng ?? 'schema/tei_jtei.rng';
  const css = config.schema?.css ?? 'schema/tei.css';

  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlModelPi(rng)}
${stylesheetPi(css)}
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt>
      <title type="main">Article title</title>
      <author>
        <name>
          <forename>Given</forename>
          <surname>Name</surname>
        </name>
        <affiliation>Affiliation</affiliation>
        <email>email@example.com</email>
      </author>
    </titleStmt>
    <publicationStmt><publisher/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
  <profileDesc>
    <textClass>
      <keywords>
        <term>Keyword</term>
      </keywords>
    </textClass>
  </profileDesc>
</teiHeader>
<text>
  <front>
    <div type="abstract">
      <head>Abstract</head>
      <p>Abstract text</p>
    </div>
  </front>
  <body>
    <div>
      <head>Section heading</head>
      <p>Paragraph text</p>
    </div>
  </body>
  <back>
    <div type="bibliography">
      <head>Bibliography</head>
      <listBibl>
        <bibl>Bibliographic entry</bibl>
      </listBibl>
    </div>
  </back>
</text>
</TEI>`;
};

/** Orlando ENTRY skeleton — author standard name, summary, biography life events, writing sections. */
export const buildOrlandoSkeletonXml = (config: SchemaTemplateConfig): string => {
  const rng = config.schema?.rng ?? 'schema/orlando_entry.rng';
  const css = config.schema?.css ?? 'schema/orlando.css';

  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlModelPi(rng)}
${stylesheetPi(css)}
<ENTRY ID="UNTITL" PERSON="WRITER">
<ORLANDOHEADER>
  <FILEDESC>
    <TITLESTMT><DOCTITLE>Untitled</DOCTITLE></TITLESTMT>
    <PUBLICATIONSTMT><AUTHORITY/></PUBLICATIONSTMT>
    <SOURCEDESC>Born digital</SOURCEDESC>
  </FILEDESC>
  <REVISIONDESC>
    <RESPONSIBILITY RESP="IMG" WORKSTATUS="SUB" WORKVALUE="I">
      <DATE>2026</DATE>
    </RESPONSIBILITY>
  </REVISIONDESC>
</ORLANDOHEADER>
<DIV0>
  <STANDARD>Author name</STANDARD>
  <AUTHORSUMMARY><P>Author summary</P></AUTHORSUMMARY>
  <BIOGRAPHY>
    <HEADING>Biography</HEADING>
    <DIV1>
      <BIRTH>
        <DIV2><SHORTPROSE><P>Birth</P></SHORTPROSE></DIV2>
      </BIRTH>
      <DEATH>
        <DIV2><SHORTPROSE><P>Death</P></SHORTPROSE></DIV2>
      </DEATH>
      <EDUCATION>
        <DIV2><SHORTPROSE><P>Education</P></SHORTPROSE></DIV2>
      </EDUCATION>
    </DIV1>
  </BIOGRAPHY>
  <WRITING>
    <HEADING>Writing</HEADING>
    <DIV1>
      <DIV2>
        <PRODUCTION><P>Production</P></PRODUCTION>
        <TEXTUALFEATURES><SHORTPROSE><P>Textual features</P></SHORTPROSE></TEXTUALFEATURES>
        <RECEPTION><SHORTPROSE><P>Reception</P></SHORTPROSE></RECEPTION>
      </DIV2>
    </DIV1>
  </WRITING>
  <WORKSCITED><SOURCE>Source</SOURCE></WORKSCITED>
</DIV0>
</ENTRY>`;
};

/** CBETA's own namespace, declared on the root so spliced `<cb:div>` markup resolves. */
export const CBETA_NS = 'http://www.cbeta.org/ns/1.0';

/**
 * CBETA P5 skeleton. `xmlns:cb` is declared so native CBETA markup (`<cb:div>`,
 * `<cb:tt>`, …) spliced in by the importer resolves; the placeholder body
 * division is a plain `<div>` — the Grognard-loosened schema (`ljb-cbeta-loosen v2`)
 * accepts `<div>` and `<cb:div>` interchangeably wherever a division is allowed,
 * so this same skeleton is a valid target for the Daozang / Kanripo / Wikisource
 * / BDRC importers too.
 */
export const buildCbetaSkeletonXml = (config: SchemaTemplateConfig): string => {
  const rng = config.schema?.rng ?? 'schema/cbeta_p5.rng';
  const css = config.schema?.css ?? 'schema/cbeta.css';

  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlModelPi(rng)}
${stylesheetPi(css)}
<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="${CBETA_NS}">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><publisher/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
</teiHeader>
<text>
  <body>
    <div type="text">
      <head>Section heading</head>
      <p>Paragraph text</p>
    </div>
  </body>
</text>
</TEI>`;
};

export const buildSkeletonForCatalog = (config: SchemaTemplateConfig): string => {
  const catalogId = config.schema?.catalogId;
  if (catalogId === 'orlando') return buildOrlandoSkeletonXml(config);
  if (catalogId === 'jTei') return buildJTeiSkeletonXml(config);
  if (catalogId === 'cbeta') return buildCbetaSkeletonXml(config);
  return buildTeiSkeletonXml(config);
};
