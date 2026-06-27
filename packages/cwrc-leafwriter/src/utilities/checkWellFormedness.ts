export type XMLValidity =
  | { valid: true }
  | {
      valid: false;
      error: {
        message: string;
        positions?: {
          line: number;
          col: number;
        }[];
      };
    };

export const checkWellFormedness = (content: string): XMLValidity => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  const errorString = errorNode?.querySelector('div')?.textContent;

  if (!errorString) {
    return { valid: true };
  }

  const lines = [...errorString.matchAll(/line ([0-9]*)/g)];
  const column = [...errorString.matchAll(/column ([0-9]*)/g)];

  const positions = lines.map((line, index) => ({
    line: Number(line[1]),
    col: Number(column[index]?.[1]) ?? 0,
  }));

  return {
    valid: false,
    error: {
      message: errorString,
      positions,
    },
  };
};
