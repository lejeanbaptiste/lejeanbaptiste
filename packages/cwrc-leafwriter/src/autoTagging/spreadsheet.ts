import JSZip from 'jszip';

/**
 * Read the first sheet of an xlsx or LibreOffice/ods spreadsheet into a grid
 * of cell strings, so the dictionary parser can treat it like a CSV. Both
 * formats are ZIP archives of XML; we unzip with JSZip and parse with the
 * DOM, avoiding a heavyweight spreadsheet dependency.
 */
export async function readSpreadsheet(buffer: ArrayBuffer, filename: string): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  if (zip.file('content.xml')) return readOds(zip);
  if (zip.file('xl/workbook.xml')) return readXlsx(zip);
  throw new Error(`${filename} is not a recognized xlsx or ods spreadsheet.`);
}

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

/** Excel column reference letters ("A", "AB") → zero-based index. */
function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '');
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

async function readXlsx(zip: JSZip): Promise<string[][]> {
  const sharedStrings: string[] = [];
  const sharedFile = zip.file('xl/sharedStrings.xml');
  if (sharedFile) {
    const doc = parseXml(await sharedFile.async('string'));
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      // concatenate all <t> runs within the shared-string item
      const runs = Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '');
      sharedStrings.push(runs.join(''));
    }
  }

  // First worksheet by relationship order; fall back to sheet1.xml.
  const sheetPath =
    Object.keys(zip.files)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()[0] ?? 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return [];

  const doc = parseXml(await sheetFile.async('string'));
  const rows: string[][] = [];
  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = [];
    for (const cell of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = cell.getAttribute('r');
      const col = ref ? columnIndex(ref) : cells.length;
      const type = cell.getAttribute('t');
      let value: string;
      if (type === 'inlineStr') {
        value = Array.from(cell.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join('');
      } else {
        const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
        value = type === 's' ? (sharedStrings[Number(raw)] ?? '') : raw;
      }
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}

async function readOds(zip: JSZip): Promise<string[][]> {
  const contentFile = zip.file('content.xml');
  if (!contentFile) return [];
  const doc = parseXml(await contentFile.async('string'));

  const table = doc.getElementsByTagName('table:table')[0];
  if (!table) return [];

  const rows: string[][] = [];
  for (const rowEl of Array.from(table.getElementsByTagName('table:table-row'))) {
    const rowRepeat = clampRepeat(rowEl.getAttribute('table:number-rows-repeated'));
    const cells: string[] = [];
    for (const cell of Array.from(rowEl.getElementsByTagName('table:table-cell'))) {
      const text = Array.from(cell.getElementsByTagName('text:p'))
        .map((p) => p.textContent ?? '')
        .join('\n');
      const colRepeat = clampRepeat(cell.getAttribute('table:number-columns-repeated'));
      for (let i = 0; i < colRepeat; i++) cells.push(text);
    }
    // trim trailing empties produced by ods's padding cells
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    for (let i = 0; i < rowRepeat; i++) rows.push([...cells]);
  }
  // trim trailing empty rows
  while (rows.length > 0 && rows[rows.length - 1]!.length === 0) rows.pop();
  return rows;
}

/**
 * ods repeats trailing empty cells/rows with huge counts to fill the grid;
 * cap the repeat so a padding cell can't explode into thousands of columns.
 */
function clampRepeat(attr: string | null): number {
  const n = attr ? parseInt(attr, 10) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 1024);
}
