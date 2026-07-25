/** Maps manifest auto-tagging producer ids to core calendar workflow steps. */
export type CjkDatesAutoTaggingStep = 'tag' | 'resolve';

const CJK_DATES_PRODUCER_STEPS: Record<string, CjkDatesAutoTaggingStep> = {
  'cjk-dates-propose': 'tag',
  'cjk-dates-disambiguate': 'resolve',
};

export function cjkDatesStepForProducer(producerId: string): CjkDatesAutoTaggingStep | null {
  return CJK_DATES_PRODUCER_STEPS[producerId] ?? null;
}
