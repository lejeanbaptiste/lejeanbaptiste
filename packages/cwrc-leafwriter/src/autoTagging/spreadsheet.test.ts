import JSZip from 'jszip';
import { entriesFromRows } from './dictionary';
import { readSpreadsheet } from './spreadsheet';

const buildXlsx = async (): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="S" r:id="r1"/></sheets></workbook>');
  zip.file(
    'xl/sharedStrings.xml',
    `<sst><si><t>string</t></si><si><t>tag</t></si><si><t>張衡</t></si><si><t>persName</t></si><si><t>洛陽</t></si><si><t>placeName</t></si></sst>`,
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
      <row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c></row>
    </sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
};

const buildOds = async (): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  zip.file(
    'content.xml',
    `<office:document-content
        xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
        xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
        xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
      <office:body><office:spreadsheet>
        <table:table table:name="Sheet1">
          <table:table-row>
            <table:table-cell><text:p>張衡</text:p></table:table-cell>
            <table:table-cell><text:p>persName</text:p></table:table-cell>
          </table:table-row>
          <table:table-row>
            <table:table-cell><text:p>洛陽</text:p></table:table-cell>
            <table:table-cell><text:p>placeName</text:p></table:table-cell>
            <table:table-cell table:number-columns-repeated="16"/>
          </table:table-row>
        </table:table>
      </office:spreadsheet></office:body>
    </office:document-content>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
};

describe('readSpreadsheet', () => {
  it('reads an xlsx sheet with shared strings and a header row', async () => {
    const rows = await readSpreadsheet(await buildXlsx(), 'names.xlsx');
    expect(rows).toEqual([
      ['string', 'tag'],
      ['張衡', 'persName'],
      ['洛陽', 'placeName'],
    ]);
    // feeds the dictionary parser unchanged
    expect(entriesFromRows(rows)).toEqual([
      { string: '張衡', tag: 'persName' },
      { string: '洛陽', tag: 'placeName' },
    ]);
  });

  it('reads an ods sheet and trims its trailing padding cells', async () => {
    const rows = await readSpreadsheet(await buildOds(), 'names.ods');
    expect(rows).toEqual([
      ['張衡', 'persName'],
      ['洛陽', 'placeName'],
    ]);
  });

  it('rejects a zip that is neither xlsx nor ods', async () => {
    const zip = new JSZip();
    zip.file('random.txt', 'hello');
    await expect(readSpreadsheet(await zip.generateAsync({ type: 'arraybuffer' }), 'x.zip')).rejects.toThrow(
      /not a recognized/,
    );
  });
});
