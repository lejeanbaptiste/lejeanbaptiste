export const AI_PUNCT_V2_PROMPT_VERSION = 'ai-punct-v2';
export const AI_PUNCT_PROMPT_VERSION = 'ai-punct-v3';

export interface PunctPromptSegment {
  kind: 'text' | 'comm';
  han: string;
  preceding_comm?: string;
  following_comm?: string;
}

const ALLOWED_MARKS = '。，、：；？！「」『』·《》';

export function buildPlainPunctSystemPrompt(kind: 'text' | 'comm'): string {
  const role =
    kind === 'comm'
      ? 'You punctuate interlinear commentary (注) in classical Chinese.'
      : 'You punctuate main classical Chinese text (句读).';
  return [
    role,
    '',
    'Return naturally punctuated classical Chinese with appropriate sentence breaks.',
    'Use blank lines between paragraphs where the sense requires a new paragraph.',
    '',
    'Rules:',
    `- Use standard marks: ${ALLOWED_MARKS}`,
    '- Do NOT wrap the answer in JSON or markdown fences.',
    '- Output plain punctuated text only.',
    '- Punctuation will be transferred mechanically onto the source; focus on good 句读.',
  ].join('\n');
}

export function buildPlainPunctUserPrompt(segment: PunctPromptSegment): string {
  const lines = [
    `Segment kind: ${segment.kind}`,
    '',
    'Base text (Han only — punctuate this string):',
    segment.han,
  ];
  if (segment.preceding_comm) {
    lines.push(
      '',
      'Preceding commentary (context only — do not punctuate):',
      segment.preceding_comm,
    );
  }
  if (segment.following_comm) {
    lines.push(
      '',
      'Following commentary (context only — do not punctuate):',
      segment.following_comm,
    );
  }
  return lines.join('\n');
}

export function buildPlainPunctPrompt(segment: PunctPromptSegment) {
  return {
    system: buildPlainPunctSystemPrompt(segment.kind),
    user: buildPlainPunctUserPrompt(segment),
  };
}

export function stripPlainPunctResponse(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:[\w-]*)?\s*([\s\S]*?)```$/);
  return (fenced ? fenced[1]! : trimmed).trim();
}

// --- v2 JSON anchor prompts (fallback) ---

export function buildPunctSystemPrompt(kind: 'text' | 'comm'): string {
  const role =
    kind === 'comm'
      ? 'You punctuate interlinear commentary (注) in classical Chinese.'
      : 'You punctuate main classical Chinese text (句读).';
  return [
    role,
    '',
    'Return ONLY valid JSON matching the schema.',
    '',
    'Each insertion places ONE mark immediately AFTER one Han character in the base text.',
    'Do NOT ask for character indices — use left + occurrence instead:',
    '',
    '- left: exactly ONE Han character copied from the base text (the character after which the mark is inserted).',
    '- occurrence: 1-based count if that character repeats (1 if it appears only once).',
    '- mark: one allowed punctuation character.',
    '',
    'Example: base text 學而時習之 → insert ， after 習 → {"left":"習","occurrence":1,"mark":"，"}',
    'Example: base text 人不知而不慍 → insert 。 after 慍 → {"left":"慍","occurrence":1,"mark":"。"}',
    '',
    'Rules:',
    '- Do NOT change, add, remove, or substitute any Han characters.',
    '- Do NOT normalize variants or simplify/traditional forms.',
    `- Allowed marks only: ${ALLOWED_MARKS}`,
    '- Do NOT use brackets or parentheses.',
    '- Do NOT suggest paragraph breaks.',
    '- Copy left from the base text exactly; do not paraphrase.',
  ].join('\n');
}

export function buildPunctUserPrompt(segment: PunctPromptSegment, chunkOffset = 0): string {
  const lines = [`Segment kind: ${segment.kind}`];
  if (chunkOffset > 0) {
    lines.push(`Note: this is a continuation chunk; left/occurrence refer to THIS chunk only.`);
  }
  lines.push('', 'Base text (Han only — punctuate this string):', segment.han);
  if (segment.preceding_comm) {
    lines.push(
      '',
      'Preceding commentary (context only — do not punctuate):',
      segment.preceding_comm,
    );
  }
  if (segment.following_comm) {
    lines.push(
      '',
      'Following commentary (context only — do not punctuate):',
      segment.following_comm,
    );
  }
  return lines.join('\n');
}

export function buildPunctPrompt(segment: PunctPromptSegment, chunkOffset = 0) {
  return {
    system: buildPunctSystemPrompt(segment.kind),
    user: buildPunctUserPrompt(segment, chunkOffset),
  };
}
