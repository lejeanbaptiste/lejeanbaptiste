import type { EntitySummary } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';

function formatDates(entity: EntitySummary): string {
  if (entity.startYear == null && entity.endYear == null) return '';
  return ` (${entity.startYear ?? '?'}–${entity.endYear ?? '?'})`;
}

/** Human-readable label for one row in the database viewer's entity list. */
export function databaseEntityLabel(entity: EntitySummary): string {
  const name = entity.names[0]?.trim() || '(unnamed)';
  const romanized = entity.romanized?.trim();
  const romanizedPart = romanized && romanized !== name ? ` ${romanized}` : '';
  const datePart = entity.kind === 'person' ? formatDates(entity) : '';
  return `${name}${romanizedPart}${datePart}`;
}
