export type StoredCursorPosition =
  | { mode: 'source'; offset: number }
  | { mode: 'visual'; offsetInElementText: number; teiXPath: string };

/** Drop source-mode positions — project open should default to WYSIWYG, not restore source view. */
export const filterVisualCursorPositions = <T extends StoredCursorPosition>(
  positions: Record<string, T>,
): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const [filePath, position] of Object.entries(positions)) {
    if (position?.mode === 'visual') out[filePath] = position;
  }
  return out;
};
