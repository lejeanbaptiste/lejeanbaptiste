type FormatConversionCheck = 'TRANSKRIBUS';

const isTranskribus = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  if (!doc) return false;
  const header = doc.querySelector('teiHeader');
  if (!header) return false;
  const publisher = header.querySelector('publisher');
  if (publisher?.textContent !== 'tranScriptorium') return false;
  return true;
};

const formatCheck: Record<FormatConversionCheck, (content: string) => boolean> = {
  TRANSKRIBUS: isTranskribus,
};

export const formatCheckers = Object.entries(formatCheck);
