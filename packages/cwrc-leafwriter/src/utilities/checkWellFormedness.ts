import { collectXmlParseErrors } from './collectXmlParseErrors';

export type XMLParseErrorPosition = {
  line: number;
  col: number;
  message?: string;
};

export type XMLValidity =
  | { valid: true }
  | {
      valid: false;
      error: {
        message: string;
        positions?: XMLParseErrorPosition[];
      };
    };

const formatParseErrorMessage = (errors: XMLParseErrorPosition[]): string => {
  if (errors.length === 1) {
    const only = errors[0];
    return `Line ${only.line}, column ${only.col}: ${only.message ?? 'Invalid XML'}`;
  }

  return errors
    .map(
      (error) =>
        `Line ${error.line}, column ${error.col}: ${error.message ?? 'Invalid XML'}`,
    )
    .join('\n');
};

export const checkWellFormedness = (content: string): XMLValidity => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  const errorNode = doc.querySelector('parsererror');

  if (!errorNode) {
    return { valid: true };
  }

  const saxErrors = collectXmlParseErrors(content);

  if (saxErrors.length > 0) {
    const positions = saxErrors.map(({ line, col, message }) => ({ line, col, message }));

    return {
      valid: false,
      error: {
        message: formatParseErrorMessage(positions),
        positions,
      },
    };
  }

  const errorString =
    errorNode.querySelector('div')?.textContent ?? errorNode.textContent ?? 'Invalid XML';
  const lines = [...errorString.matchAll(/line ([0-9]*)/g)];
  const column = [...errorString.matchAll(/column ([0-9]*)/g)];

  const positions = lines.map((line, index) => ({
    line: Number(line[1]),
    col: Number(column[index]?.[1]) ?? 1,
    message: errorString,
  }));

  return {
    valid: false,
    error: {
      message: errorString,
      positions: positions.length > 0 ? positions : [{ line: 1, col: 1, message: errorString }],
    },
  };
};
