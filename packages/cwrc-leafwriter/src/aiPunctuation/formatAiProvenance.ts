import type { KanripoNormalizeMode } from '../../../../apps/commons/src/desktop/kanripoImportXml';

export interface AiPunctApplyStats {
  applied: number;
  dropped_anchor: number;
  dropped_schema: number;
  skipped_punctuated: number;
  segments_total: number;
  segments_applied: number;
  align_failed: number;
  reflowed: boolean;
}

export function formatAiProvenance(options: {
  modelId: string;
  promptVersion: string;
  normalize: KanripoNormalizeMode | 'none';
  stats: AiPunctApplyStats;
}): string {
  const norm =
    options.normalize === 'off' || options.normalize === 'none'
      ? 'none'
      : options.normalize;
  return [
    `AI punctuation (model: ${options.modelId}, ${options.promptVersion})`,
    `normalisation: ${norm}`,
    `marks_added ${options.stats.applied}`,
    `segments_applied ${options.stats.segments_applied}`,
    `align_failed ${options.stats.align_failed}`,
    `reflowed ${options.stats.reflowed ? 'yes' : 'no'}`,
    `skipped_punctuated ${options.stats.skipped_punctuated}`,
    `segments ${options.stats.segments_total}`,
  ].join('; ');
}

export function emptyAiPunctStats(segmentsTotal = 0): AiPunctApplyStats {
  return {
    applied: 0,
    dropped_anchor: 0,
    dropped_schema: 0,
    skipped_punctuated: 0,
    segments_total: segmentsTotal,
    segments_applied: 0,
    align_failed: 0,
    reflowed: false,
  };
}

export function mergeAiPunctStats(
  target: AiPunctApplyStats,
  partial: Partial<AiPunctApplyStats>,
): AiPunctApplyStats {
  return {
    applied: partial.applied ?? target.applied,
    dropped_anchor: target.dropped_anchor + (partial.dropped_anchor ?? 0),
    dropped_schema: target.dropped_schema + (partial.dropped_schema ?? 0),
    skipped_punctuated: partial.skipped_punctuated ?? target.skipped_punctuated,
    segments_total: partial.segments_total ?? target.segments_total,
    segments_applied: partial.segments_applied ?? target.segments_applied,
    align_failed: partial.align_failed ?? target.align_failed,
    reflowed: partial.reflowed ?? target.reflowed,
  };
}
