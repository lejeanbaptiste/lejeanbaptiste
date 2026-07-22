import $ from 'jquery';
import { syncCorrectionEntityDom } from '../entities/correctionDom';
import type Writer from '../Writer';

export type CorrectionKind = 'substitution' | 'supplied' | 'surplus';

const TAG_FOR_KIND: Record<CorrectionKind, string> = {
  substitution: 'choice',
  supplied: 'supplied',
  surplus: 'surplus',
};

export type CorrectionInferResult =
  | { kind: CorrectionKind }
  | { kind: 'invalid'; errorKey: string };

export const inferCorrectionKind = (sicText: string, corrText: string): CorrectionInferResult => {
  const sic = sicText.trim();
  const corr = corrText.trim();

  if (!sic && !corr) {
    return { kind: 'invalid', errorKey: 'LWC.desktop.correction.empty_error' };
  }
  if (!sic && corr) return { kind: 'supplied' };
  if (sic && !corr) return { kind: 'surplus' };
  if (sic === corr) {
    return { kind: 'invalid', errorKey: 'LWC.desktop.correction.same_text_error' };
  }
  return { kind: 'substitution' };
};

export const getCorrectionEntityAtSelection = (
  writer: Writer,
): { entityId: string; element: HTMLElement } | null => {
  const editor = writer.editor;
  if (!editor) return null;

  const node = editor.selection.getNode();
  const entityEl = $(node).closest('.entity.correction[_entity="true"]', editor.getBody())[0] as
    | HTMLElement
    | undefined;
  if (!entityEl) return null;

  const entityId = entityEl.getAttribute('id') ?? entityEl.getAttribute('name');
  if (!entityId) return null;

  const entity = writer.entitiesManager.getEntity(entityId);
  if (!entity || entity.getType() !== 'correction') return null;

  return { entityId, element: entityEl };
};

export const readCorrectionFormFromEntity = (
  writer: Writer,
  entityId: string,
): {
  sicText: string;
  corrText: string;
  attributes: Record<string, string>;
  tag: string;
} | null => {
  const entity = writer.entitiesManager.getEntity(entityId);
  if (!entity) return null;

  const tag = entity.getTag() ?? 'choice';
  const attributes = { ...entity.getAttributes() };

  if (tag === 'surplus') {
    return {
      sicText: entity.getContent() ?? '',
      corrText: '',
      attributes,
      tag,
    };
  }

  if (tag === 'supplied') {
    return {
      sicText: '',
      corrText: entity.getContent() ?? '',
      attributes,
      tag,
    };
  }

  const sicText =
    entity.getCustomValue('sicText') ??
    $(`#${entityId}`, writer.editor?.getBody()).attr('data-sic-text') ??
    '';
  const corrText = entity.getCustomValue('corrText') ?? entity.getContent() ?? '';

  return { sicText, corrText, attributes, tag };
};

export const unwrapCorrectionEntity = (writer: Writer, entityId: string) => {
  const editor = writer.editor;
  if (!editor) return;

  const $tag = $(`#${entityId}`, editor.getBody());
  if (!$tag.length) return;

  writer.entitiesManager.removeHighlights();
  const text = $tag.text();
  $tag.replaceWith(editor.getDoc().createTextNode(text));
  writer.entitiesManager.removeEntity(entityId);
  writer.event('contentChanged').publish();
  editor.undoManager.add();
};

const insertCorrectionText = (
  writer: Writer,
  corrText: string,
  kind: CorrectionKind,
  sicText: string,
): Text | null => {
  const editor = writer.editor;
  if (!editor) return null;

  editor.selection.moveToBookmark(editor.currentBookmark!);
  const range = editor.selection.getRng();

  if (kind === 'surplus') {
    return null;
  }

  if (range.collapsed) {
    const textNode = editor.getDoc().createTextNode(corrText);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    editor.selection.setRng(range);
    editor.currentBookmark = editor.selection.getBookmark(1);
    return textNode;
  }

  const tempId = writer.getUniqueId('temp');
  const $temp = $(`<span id="${tempId}"/>`, editor.getDoc());
  if ($temp[0]) range.surroundContents($temp[0]);
  $temp.text(corrText);
  const textNode = $temp[0]?.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

  $(textNode).unwrap();
  range.selectNodeContents(textNode);
  editor.selection.setRng(range);
  editor.currentBookmark = editor.selection.getBookmark(1);
  return textNode as Text;
};

const stampSicTextAfterAdd = (
  writer: Writer,
  sicText: string,
  textNode: Text | null,
) => {
  if (!sicText || !textNode) return;
  const entitySpan = textNode.parentElement;
  if (entitySpan?.classList.contains('correction')) {
    $(entitySpan).attr('data-sic-text', sicText);
  }
};

export const applyCorrection = (
  writer: Writer,
  payload: {
    mode: 'add' | 'edit';
    entityId?: string;
    sicText: string;
    corrText: string;
    attributes: Record<string, string>;
  },
): { ok: true } | { ok: false; errorKey: string } => {
  const editor = writer.editor;
  if (!editor) return { ok: false, errorKey: 'LWC.desktop.correction.editor_unavailable' };

  const inferred = inferCorrectionKind(payload.sicText, payload.corrText);
  if (inferred.kind === 'invalid') {
    return { ok: false, errorKey: inferred.errorKey };
  }

  const kind = inferred.kind;
  const sicText = payload.sicText.trim();
  const corrText = payload.corrText.trim();
  const customValues: Record<string, string> = { correctionKind: kind };

  if (kind === 'substitution') {
    customValues.sicText = sicText;
    customValues.corrText = corrText;
  } else if (kind === 'supplied') {
    customValues.corrText = corrText;
  }

  if (payload.mode === 'edit' && payload.entityId) {
    const entity = writer.entitiesManager.getEntity(payload.entityId);
    if (!entity) return { ok: false, errorKey: 'LWC.desktop.correction.entity_not_found' };

    writer.entitiesManager.setCurrentEntity(payload.entityId);

    const $entity = $(`#${payload.entityId}`, editor.getBody());
    if (!$entity.length) {
      return { ok: false, errorKey: 'LWC.desktop.correction.entity_not_found' };
    }

    entity.setTag(TAG_FOR_KIND[kind]);
    entity.setCustomValues(
      kind === 'substitution'
        ? { correctionKind: kind, sicText, corrText }
        : kind === 'supplied'
          ? { correctionKind: kind, corrText }
          : { correctionKind: kind },
    );

    if (kind === 'surplus') {
      $entity.text(sicText).removeAttr('data-sic-text');
      entity.setContent(sicText);
    } else if (kind === 'supplied') {
      $entity.text(corrText).removeAttr('data-sic-text');
      entity.setContent(corrText);
    } else {
      $entity.text(corrText).attr('data-sic-text', sicText);
      entity.setContent(corrText);
    }

    writer.tagger.editEntity(payload.entityId, {
      attributes: payload.attributes,
      customValues: entity.getCustomValues(),
      properties: { tag: TAG_FOR_KIND[kind], type: 'correction' },
    });

    syncCorrectionEntityDom(writer, writer.entitiesManager.getEntity(payload.entityId)!);
    editor.undoManager.add();
    return { ok: true };
  }

  if (payload.mode === 'add') {
    if (!editor.currentBookmark) {
      editor.currentBookmark = editor.selection.getBookmark(1);
    }

    const textNode = insertCorrectionText(writer, corrText, kind, sicText);

    writer.tagger.finalizeEntity('correction', {
      attributes: payload.attributes,
      customValues,
      properties: { tag: TAG_FOR_KIND[kind] },
    });

    if (kind === 'substitution') {
      stampSicTextAfterAdd(writer, sicText, textNode);
    }

    const entities = writer.entitiesManager.getEntities();
    const newest = Object.values(entities).at(-1);
    if (newest) syncCorrectionEntityDom(writer, newest);

    editor.undoManager.add();
    return { ok: true };
  }

  return { ok: false, errorKey: 'LWC.desktop.correction.editor_unavailable' };
};
