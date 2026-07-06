import fs from 'fs/promises';
import path from 'path';

import { getCatalogEntry } from './schemaCatalog';
import { flattenRelaxNgGrammar } from './relaxNgFlatten';
import { ensureSchemaDir } from './schemaSetupHelpers';
import type { ProjectBundle } from './projectFile';

export const SANMIAO_PATCH_FILENAME = 'ljb-sanmiao-dates.rng';
/** Bump when the generated RNG changes so existing merged schemas get regenerated. */
export const SANMIAO_MERGE_VERSION = 5;
const MERGE_VERSION_MARKER = `ljb-sanmiao-merge v${SANMIAO_MERGE_VERSION}`;
const TEI_NS = 'http://www.tei-c.org/ns/1.0';
const TEI_CATALOG_IDS = new Set(['teiAll', 'teiLite', 'teiSimplePrint', 'jTei']);

const SANMIAO_DATE_PARTS = [
  'dyn',
  'ruler',
  'era',
  'year',
  'month',
  'int',
  'day',
  'gz',
  'sexYear',
  'suffix',
  'lp',
  'nmdgz',
  'lp_filler',
  'filler',
  'season',
  'gy',
] as const;

/** TEI catalog entries that use a P5 RelaxNG schema with `<date>`. */
export const isTeiCatalogId = (catalogId: string | undefined): boolean =>
  Boolean(catalogId && TEI_CATALOG_IDS.has(catalogId));

export const isTeiRelaxNgSchema = (rngContent: string): boolean =>
  /<define\s+name="date">/i.test(rngContent) &&
  (/TEI Edition:\s*P5/i.test(rngContent) ||
    /http:\/\/www\.tei-c\.org\/ns\/1\.0/.test(rngContent));

export const isSanmiaoMergedWrapper = (rngContent: string): boolean =>
  /ljb-sanmiao-dates\.rng/.test(rngContent) ||
  /Le Jean-Baptiste: TEI \+ sanmiao East Asian date extension/i.test(rngContent) ||
  /ljb\.sanmiao\.date\.parts/.test(rngContent);

export const isFlatRelaxNgGrammar = (rngContent: string): boolean =>
  !/<include[\s>]/i.test(rngContent);

export const isCurrentSanmiaoMergeVersion = (rngContent: string): boolean =>
  rngContent.includes(MERGE_VERSION_MARKER);

/** Attribute groups referenced on stock TEI `<date>`. */
export const extractDateAttributeRefs = (baseRng: string): string[] => {
  const match = baseRng.match(/<define\s+name="date">[\s\S]*?<\/define>/i);
  if (!match) return [];
  return [...match[0].matchAll(/<ref\s+name="([^"]+)"/g)]
    .map((item) => item[1]!)
    .filter((name) => name.startsWith('att.'));
};

export const teiCoreRngFileName = (wrapperFileName: string): string =>
  wrapperFileName.replace(/\.rng$/i, '.tei.rng');

/**
 * Replacement `<define name="date">` for the merged grammar. RelaxNG has no
 * include/except; the only way to replace a definition is to place the new
 * define directly inside `<include>`, which is what the wrapper does.
 */
const buildDateOverrideDefine = (baseRng: string): string => {
  const attRefs = extractDateAttributeRefs(baseRng);
  if (attRefs.length === 0) {
    throw new Error('Could not find TEI <date> attribute references in base schema');
  }
  const attRefLines = attRefs.map((name) => `      <ref name="${name}"/>`).join('\n');
  return `    <define name="date">
      <element name="date">
        <a:documentation>TEI date extended for sanmiao parse children and calendar resolution attributes.</a:documentation>
        <zeroOrMore>
          <choice>
            <text/>
            <ref name="model.gLike"/>
            <ref name="model.phrase"/>
            <ref name="model.global"/>
            <ref name="ljb.sanmiao.date.parts"/>
          </choice>
        </zeroOrMore>
${attRefLines}
      <ref name="ljb.sanmiao.att.resolution"/>
      </element>
    </define>`;
};

export const buildSanmiaoWrapperRng = (teiCoreFileName: string, baseRng: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0"
         ns="${TEI_NS}"
         datatypeLibrary="http://www.w3.org/2001/XMLSchema-datatypes"
         xmlns:a="http://relaxng.org/ns/compatibility/annotations/1.0">
  <a:documentation>Le Jean-Baptiste: TEI + sanmiao East Asian date extension (${MERGE_VERSION_MARKER})</a:documentation>
  <include href="${teiCoreFileName}">
${buildDateOverrideDefine(baseRng)}
  </include>
${generateSanmiaoHelperDefines()}
</grammar>
`;

const textElementDefine = (name: string): string => `
  <define name="ljb.sanmiao.${name}">
    <element name="${name}">
      <zeroOrMore>
        <choice>
          <text/>
          <ref name="model.global"/>
        </choice>
      </zeroOrMore>
    </element>
  </define>`;

/**
 * Sanmiao helper defines referenced by the `date` override. Emitted as bare
 * `<define>` elements in the wrapper grammar before flattening. Deliberately
 * does NOT define `date` — that lives in the include override.
 */
export const generateSanmiaoHelperDefines = (): string => {
  const partDefines = SANMIAO_DATE_PARTS.map((name) => textElementDefine(name)).join('\n');
  const partRefs = SANMIAO_DATE_PARTS.map((name) => `          <ref name="ljb.sanmiao.${name}"/>`).join(
    '\n',
  );

  return `${partDefines}
  <define name="ljb.sanmiao.rel">
    <element name="rel">
      <optional>
        <attribute name="dir">
          <text/>
        </attribute>
      </optional>
      <optional>
        <attribute name="unit">
          <text/>
        </attribute>
      </optional>
      <zeroOrMore>
        <choice>
          <text/>
          <ref name="model.global"/>
        </choice>
      </zeroOrMore>
    </element>
  </define>
  <define name="ljb.sanmiao.date.parts">
    <choice>
${partRefs}
          <ref name="ljb.sanmiao.rel"/>
    </choice>
  </define>
  <define name="ljb.sanmiao.att.resolution">
    <optional><attribute name="dyn_id"><data type="integer"/></attribute></optional>
    <optional><attribute name="ruler_id"><data type="integer"/></attribute></optional>
    <optional><attribute name="era_id"><data type="integer"/></attribute></optional>
    <optional><attribute name="cal_stream"><data type="integer"/></attribute></optional>
    <optional><attribute name="ind_year"><data type="integer"/></attribute></optional>
    <optional><attribute name="year"><data type="integer"/></attribute></optional>
    <optional><attribute name="sex_year"><data type="integer"/></attribute></optional>
    <optional><attribute name="month"><data type="integer"/></attribute></optional>
    <optional><attribute name="intercalary"><data type="integer"/></attribute></optional>
    <optional><attribute name="day"><data type="integer"/></attribute></optional>
    <optional><attribute name="gz"><data type="integer"/></attribute></optional>
    <optional><attribute name="nmd_gz"><data type="integer"/></attribute></optional>
    <optional><attribute name="lp"><data type="integer"/></attribute></optional>
    <optional><attribute name="jdn"><data type="decimal"/></attribute></optional>
    <optional><attribute name="jdnEnd"><data type="decimal"/></attribute></optional>
    <optional><attribute name="dila_id"><text/></attribute></optional>
  </define>`;
};

export interface SanmiaoSchemaMergeResult {
  /** Fully resolved grammar written to the project's main `.rng` path. */
  flatRng: string;
  teiCoreRng: string;
  teiCoreFileName: string;
}

const resolveTeiCoreInclude =
  (teiCoreFileName: string, teiCoreRng: string) =>
  (href: string): string | null => {
    const includeFile = href.includes('/')
      ? (href.match(/(.*\/)(.*)/)?.[2] ?? href)
      : href;
    if (includeFile === teiCoreFileName) return teiCoreRng;
    return null;
  };

/**
 * Build merged schema files from upstream TEI RelaxNG content: the pristine TEI
 * core (`*.tei.rng`) and a fully flattened project schema with sanmiao date
 * extensions baked in (zero `<include>` tags).
 */
export const buildSanmiaoMergedSchemaFiles = (
  upstreamRng: string,
  wrapperFileName: string,
): SanmiaoSchemaMergeResult => {
  if (!isTeiRelaxNgSchema(upstreamRng)) {
    throw new Error('Schema does not look like a TEI RelaxNG file with <date>');
  }
  const teiCoreFileName = teiCoreRngFileName(wrapperFileName);
  const wrapperRng = buildSanmiaoWrapperRng(teiCoreFileName, upstreamRng);
  const flatRng = flattenRelaxNgGrammar(
    wrapperRng,
    resolveTeiCoreInclude(teiCoreFileName, upstreamRng),
  );
  if (!isFlatRelaxNgGrammar(flatRng)) {
    throw new Error('Sanmiao schema flatten did not remove all RelaxNG includes');
  }
  return {
    teiCoreRng: upstreamRng,
    flatRng,
    teiCoreFileName,
  };
};

export const shouldMergeSanmiaoDates = (
  catalogId: string | undefined,
  rngContent: string,
): boolean => {
  if (isSanmiaoMergedWrapper(rngContent)) return false;
  if (catalogId) return isTeiCatalogId(catalogId);
  return isTeiRelaxNgSchema(rngContent);
};

export const writeSanmiaoMergedTeiSchema = async (
  schemaDir: string,
  wrapperFileName: string,
  upstreamRng: string,
): Promise<void> => {
  const merged = buildSanmiaoMergedSchemaFiles(upstreamRng, wrapperFileName);
  await fs.writeFile(path.join(schemaDir, merged.teiCoreFileName), merged.teiCoreRng, 'utf-8');
  await fs.writeFile(path.join(schemaDir, wrapperFileName), merged.flatRng, 'utf-8');
  // Remove the obsolete second-include patch file from v1/v2 merges (helpers
  // are now inlined into the wrapper).
  await fs.rm(path.join(schemaDir, SANMIAO_PATCH_FILENAME), { force: true });
};

/**
 * Patch an existing project TEI schema in place (idempotent). Also regenerates
 * wrappers produced by an older merge version, using the pristine upstream copy
 * preserved as `*.tei.rng`.
 */
export const ensureSanmiaoDatesSchemaMerged = async (
  bundle: ProjectBundle,
): Promise<boolean> => {
  const schema = bundle.config.schema;
  if (!schema?.rng) return false;

  const schemaDir = await ensureSchemaDir(bundle.rootPath);
  const wrapperPath = path.join(bundle.rootPath, schema.rng);
  const wrapperFileName = path.basename(schema.rng);

  let wrapperContent: string;
  try {
    wrapperContent = await fs.readFile(wrapperPath, 'utf-8');
  } catch {
    return false;
  }

  if (isSanmiaoMergedWrapper(wrapperContent)) {
    if (isCurrentSanmiaoMergeVersion(wrapperContent)) return false;
    let coreContent: string;
    try {
      coreContent = await fs.readFile(
        path.join(schemaDir, teiCoreRngFileName(wrapperFileName)),
        'utf-8',
      );
    } catch {
      return false;
    }
    if (!isTeiRelaxNgSchema(coreContent)) return false;
    await writeSanmiaoMergedTeiSchema(schemaDir, wrapperFileName, coreContent);
    return true;
  }

  const catalogId = schema.catalogId;
  if (catalogId && !isTeiCatalogId(catalogId) && !isTeiRelaxNgSchema(wrapperContent)) {
    return false;
  }

  if (!isTeiRelaxNgSchema(wrapperContent)) return false;

  await writeSanmiaoMergedTeiSchema(schemaDir, wrapperFileName, wrapperContent);
  return true;
};

export const catalogEntrySupportsSanmiaoMerge = (catalogId: string): boolean =>
  isTeiCatalogId(catalogId);

export const getCatalogEntryForMerge = (catalogId: string) => getCatalogEntry(catalogId);
