/** Traditional Chinese reading marks allowed for AI punctuation (no brackets). */
export const AI_PUNCT_MARKS = [
  '。',
  '，',
  '、',
  '：',
  '；',
  '？',
  '！',
  '「',
  '」',
  '『',
  '』',
  '·',
  '《',
  '》',
] as const;

export type AiPunctMark = (typeof AI_PUNCT_MARKS)[number];

export const MIN_SEGMENT_HAN = 20;
export const CHUNK_HAN = 500;
export const CHUNK_OVERLAP = 50;
export const PLAIN_CHUNK_HAN = 400;

/** Model output — anchor by character + occurrence, not index. */
export interface RawPunctInsertion {
  mark: string;
  left: string;
  occurrence: number;
  /** Legacy / test fixtures only; ignored when resolving from anchor. */
  afterHan?: number;
}

export interface VerifiedPunctInsertion {
  afterHan: number;
  mark: string;
  global_han: number;
}

export function punctuationResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['insertions'],
    properties: {
      insertions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['mark', 'left', 'occurrence'],
          properties: {
            mark: { type: 'string', enum: [...AI_PUNCT_MARKS] },
            left: { type: 'string', minLength: 1, maxLength: 3 },
            occurrence: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  };
}

export function stripAiPunct(text: string): string {
  const set = new Set(AI_PUNCT_MARKS);
  return [...text].filter((ch) => !set.has(ch as AiPunctMark)).join('');
}
