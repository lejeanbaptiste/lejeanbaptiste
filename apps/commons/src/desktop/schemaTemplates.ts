import type { ProjectFileConfig } from './projectTypes';

/** Minimal TEI skeleton — shared for teiAll and teiLite (Phase 2). */
export const buildTeiSkeletonXml = (config: ProjectFileConfig): string => {
  const rng = config.schema?.rng ?? 'schema/tei_lite.rng';
  const css = config.schema?.css ?? 'schema/tei.css';

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="${rng}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<?xml-stylesheet type="text/css" href="${css}"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><p/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
</teiHeader>
<text>
  <body>
    <div type="text">
      <p>&#8203;</p>
    </div>
  </body>
</text>
</TEI>`;
};
