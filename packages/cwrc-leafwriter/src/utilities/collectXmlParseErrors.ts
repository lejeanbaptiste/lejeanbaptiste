import sax from 'sax';

export type XmlParseError = {
  line: number;
  col: number;
  message: string;
};

const NOISE_MESSAGES = new Set(['Invalid characters in closing tag', 'Unexpected end']);

const dedupeParseErrors = (errors: XmlParseError[]): XmlParseError[] => {
  const byLine = new Map<number, XmlParseError>();

  for (const error of errors) {
    if (NOISE_MESSAGES.has(error.message)) continue;

    const existing = byLine.get(error.line);
    if (!existing || error.message.length > existing.message.length) {
      byLine.set(error.line, error);
    }
  }

  return Array.from(byLine.values()).sort(
    (left, right) => left.line - right.line || left.col - right.col,
  );
};

export const collectXmlParseErrors = (content: string): XmlParseError[] => {
  const errors: XmlParseError[] = [];
  const seen = new Set<string>();
  const parser = sax.parser(true, { position: true });

  parser.onerror = () => {
    const message = (parser.error?.message ?? 'XML parse error').split('\n')[0].trim();
    const line = parser.line + 1;
    const col = parser.column + 1;
    const key = `${line}:${col}:${message}`;

    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ line, col, message });
    }

    parser.resume();
  };

  try {
    parser.write(content).close();
  } catch {
    // sax may throw after fatal errors; collected entries are still useful
  }

  const deduped = dedupeParseErrors(errors);
  return deduped.length > 0 ? deduped : errors.slice(0, 1);
};
