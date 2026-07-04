import type { ProjectFileConfig } from './projectTypes';

const xmlModelPi = (rng: string) =>
  `<?xml-model href="${rng}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>`;

const stylesheetPi = (css: string) =>
  `<?xml-stylesheet type="text/css" href="${css}"?>`;

/** TEI skeleton — shared for teiAll, teiLite, and teiSimplePrint. */
export const buildTeiSkeletonXml = (config: ProjectFileConfig): string => {
  const rng = config.schema?.rng ?? 'schema/tei_lite.rng';
  const css = config.schema?.css ?? 'schema/tei.css';

  return `<?xml version="1.0" encoding="UTF-8"?>
${xmlModelPi(rng)}
${stylesheetPi(css)}
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><authority/></publicationStmt>
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
export const buildJTeiSkeletonXml = (config: ProjectFileConfig): string => {
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
    <publicationStmt><authority/></publicationStmt>
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
export const buildOrlandoSkeletonXml = (config: ProjectFileConfig): string => {
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

export const buildSkeletonForCatalog = (config: ProjectFileConfig): string => {
  const catalogId = config.schema?.catalogId;
  if (catalogId === 'orlando') return buildOrlandoSkeletonXml(config);
  if (catalogId === 'jTei') return buildJTeiSkeletonXml(config);
  return buildTeiSkeletonXml(config);
};
