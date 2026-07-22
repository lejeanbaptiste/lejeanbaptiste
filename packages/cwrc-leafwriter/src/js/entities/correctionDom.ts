import $ from 'jquery';
import type Writer from '../Writer';
import type Entity from './Entity';

/**
 * Align a correction entity's editor DOM with its metadata so the
 * original/corrected/both display toggle works after XML import or tag conversion.
 *
 * Editor model: live span text is always the corrected/supplied/surplus reading;
 * the original sic reading lives in `data-sic-text` (not exported as XML content).
 */
export function syncCorrectionEntityDom(
  writer: Writer,
  entity: Entity,
  entityNode?: Element | null,
) {
  if (entity.getType() !== 'correction') return;

  const body = writer.editor?.getBody();
  if (!body) return;

  const $entity = entityNode ? $(entityNode) : $(`#${entity.getId()}`, body);
  if ($entity.length === 0) return;

  const tag = entity.getTag();
  const sicText = entity.getCustomValue('sicText')?.trim();
  const corrText = entity.getCustomValue('corrText')?.trim();

  if (tag === 'supplied' || tag === 'surplus') {
    $entity.removeAttr('data-sic-text');
    const text = entity.getContent() ?? $entity.text();
    if (text !== undefined && text !== '') entity.setContent(text);
    return;
  }

  if (sicText && corrText) {
    $entity.text(corrText).attr('data-sic-text', sicText);
    entity.setContent(corrText);
    return;
  }

  if (corrText) {
    $entity.text(corrText).removeAttr('data-sic-text');
    entity.setContent(corrText);
    return;
  }

  if (sicText) {
    $entity.text(sicText).attr('data-sic-text', sicText);
    entity.setContent(sicText);
  }
}

export function syncAllCorrectionEntities(writer: Writer) {
  writer.entitiesManager.eachEntity((_id: string, entity: Entity) => {
    syncCorrectionEntityDom(writer, entity);
  });
}
