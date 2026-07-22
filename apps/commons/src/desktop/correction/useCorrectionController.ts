import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyCorrection,
  getCorrectionEntityAtSelection,
  inferCorrectionKind,
  readCorrectionFormFromEntity,
  unwrapCorrectionEntity,
  type CorrectionKind,
} from '../../../../../packages/cwrc-leafwriter/src/js/correction/applyCorrection';
import {
  fetchSchemaAttributesForTag,
  type SchemaAttributeDetail,
} from '../tagging/attributeSuggestions';
import { getCaretScreenPosition } from '../tagging/editorAnchor';

const TAG_FOR_KIND: Record<CorrectionKind, string> = {
  substitution: 'choice',
  supplied: 'supplied',
  surplus: 'surplus',
};

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) &&
  window.writer?.overmindState?.ui?.editorViewMode !== 'source';

export type CorrectionPopupMode = 'add' | 'edit';

export const useCorrectionController = () => {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CorrectionPopupMode>('add');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [sicText, setSicText] = useState('');
  const [corrText, setCorrText] = useState('');
  const [cert, setCert] = useState('');
  const [extraAttributes, setExtraAttributes] = useState<Record<string, string>>({});
  const [schemaAttributes, setSchemaAttributes] = useState<SchemaAttributeDetail[]>([]);
  const [addAttrName, setAddAttrName] = useState('');
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyingRef = useRef(false);

  const inferred = useMemo(() => inferCorrectionKind(sicText, corrText), [sicText, corrText]);

  const typeLabel = useMemo(() => {
    if (inferred.kind === 'invalid') return '';
    const key = `LWC.desktop.correction.type_${inferred.kind}` as const;
    return t(key);
  }, [inferred, t]);

  const schemaTagName = useMemo(() => {
    if (inferred.kind === 'invalid') return 'choice';
    return TAG_FOR_KIND[inferred.kind];
  }, [inferred]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchSchemaAttributesForTag(schemaTagName).then((attrs) => {
      if (!cancelled) setSchemaAttributes(attrs);
    });
    return () => {
      cancelled = true;
    };
  }, [open, schemaTagName]);

  const availableAttributes = useMemo(() => {
    const used = new Set(['cert', ...Object.keys(extraAttributes)]);
    return schemaAttributes.filter((attr) => !used.has(attr.name));
  }, [extraAttributes, schemaAttributes]);

  const closePopup = useCallback(() => {
    setOpen(false);
    setEntityId(null);
    setErrorMessage(null);
    setAddAttrName('');
  }, []);

  const prepareAddMode = useCallback((): boolean => {
    const writer = window.writer;
    const editor = writer?.editor;
    const tagger = writer?.tagger;
    if (!writer || !editor || !tagger) return false;

    const requiresSelection = writer.schemaManager.mapper.doesEntityRequireSelection('correction');
    const result =
      !requiresSelection && editor.selection.isCollapsed()
        ? tagger.VALID
        : tagger.isSelectionValid({ isStructTag: false, cleanRange: true });

    if (result === tagger.NO_SELECTION) {
      writer.dialogManager.show('message', {
        title: t('LWC.desktop.correction.error_title'),
        msg: t('LWC.desktop.correction.no_selection'),
        type: 'error',
      });
      return false;
    }

    editor.currentBookmark = editor.selection.getBookmark(1);

    if (result === tagger.VALID) {
      const childName = writer.schemaManager.mapper.getParentTag('correction');

      //@ts-ignore
      let parentTag = editor.currentBookmark.rng.commonAncestorContainer;
      while (parentTag.nodeType !== Node.ELEMENT_NODE) {
        parentTag = parentTag.parentNode;
      }

      const parentName = parentTag.getAttribute('_tag');
      //@ts-ignore
      const isValid = writer.schemaManager.isTagValidChildOfParent(childName, parentName);

      if (!isValid) {
        writer.dialogManager.show('message', {
          title: t('LWC.desktop.correction.invalid_xml_title'),
          msg: t('LWC.desktop.correction.invalid_xml_message', {
            child: childName,
            parent: parentName,
          }),
          type: 'error',
        });
        return false;
      }

      const selected =
        editor.selection.isCollapsed() ? '' : editor.selection.getContent({ format: 'text' });

      setMode('add');
      setEntityId(null);
      setSicText(selected);
      setCorrText('');
      setCert('');
      setExtraAttributes({});
      setErrorMessage(null);
      setAnchor(getCaretScreenPosition());
      setOpen(true);
      return true;
    }

    if (result === tagger.OVERLAP) {
      if (writer.allowOverlap !== true) {
        writer.dialogManager.confirm({
          title: t('LWC.desktop.correction.overlap_title'),
          msg: t('LWC.desktop.correction.overlap_message'),
          showConfirmKey: 'confirm-overlapping-entities',
          type: 'info',
          height: 350,
          callback: (confirmed: boolean) => {
            if (!confirmed) return;
            writer.allowOverlap = true;
            writer.mode = writer.XMLRDF;
            const selected =
              editor.selection.isCollapsed()
                ? ''
                : editor.selection.getContent({ format: 'text' });
            setMode('add');
            setEntityId(null);
            setSicText(selected);
            setCorrText('');
            setCert('');
            setExtraAttributes({});
            setErrorMessage(null);
            setAnchor(getCaretScreenPosition());
            setOpen(true);
          },
        });
        return true;
      }

      const selected =
        editor.selection.isCollapsed() ? '' : editor.selection.getContent({ format: 'text' });
      setMode('add');
      setEntityId(null);
      setSicText(selected);
      setCorrText('');
      setCert('');
      setExtraAttributes({});
      setErrorMessage(null);
      setAnchor(getCaretScreenPosition());
      setOpen(true);
      return true;
    }

    return false;
  }, [t]);

  const prepareEditMode = useCallback((editEntityId: string): boolean => {
    const writer = window.writer;
    if (!writer?.editor) return false;

    const form = readCorrectionFormFromEntity(writer, editEntityId);
    if (!form) return false;

    writer.editor.currentBookmark = writer.editor.selection.getBookmark(1);
    writer.entitiesManager.setCurrentEntity(editEntityId);

    const { cert: certValue = '', ...rest } = form.attributes;

    setMode('edit');
    setEntityId(editEntityId);
    setSicText(form.sicText);
    setCorrText(form.corrText);
    setCert(certValue);
    setExtraAttributes(rest);
    setErrorMessage(null);
    setAnchor(getCaretScreenPosition());
    setOpen(true);
    return true;
  }, []);

  const openPopup = useCallback((): boolean => {
    if (!isVisualEditorActive()) return false;

    const writer = window.writer;
    if (!writer) return false;

    const atEntity = getCorrectionEntityAtSelection(writer);
    if (atEntity) {
      return prepareEditMode(atEntity.entityId);
    }

    return prepareAddMode();
  }, [prepareAddMode, prepareEditMode]);

  const buildAttributes = useCallback((): Record<string, string> => {
    const attributes: Record<string, string> = { ...extraAttributes };
    const trimmedCert = cert.trim();
    if (trimmedCert) attributes.cert = trimmedCert;
    return attributes;
  }, [cert, extraAttributes]);

  const onApply = useCallback(() => {
    if (applyingRef.current) return;
    const writer = window.writer;
    if (!writer) return;

    if (inferred.kind === 'invalid') {
      setErrorMessage(t(inferred.errorKey));
      return;
    }

    applyingRef.current = true;
    try {
      const result = applyCorrection(writer, {
        mode,
        entityId: entityId ?? undefined,
        sicText,
        corrText,
        attributes: buildAttributes(),
      });

      if (!result.ok) {
        setErrorMessage(t(result.errorKey));
        return;
      }

      closePopup();
    } finally {
      applyingRef.current = false;
    }
  }, [
    buildAttributes,
    closePopup,
    corrText,
    entityId,
    inferred,
    mode,
    sicText,
    t,
  ]);

  const onRemoveMarkup = useCallback(() => {
    const writer = window.writer;
    if (!writer || !entityId) return;
    unwrapCorrectionEntity(writer, entityId);
    closePopup();
  }, [closePopup, entityId]);

  const onAddAttribute = useCallback(() => {
    const name = addAttrName.trim();
    if (!name || extraAttributes[name]) return;
    setExtraAttributes((prev) => ({ ...prev, [name]: '' }));
    setAddAttrName('');
  }, [addAttrName, extraAttributes]);

  const onRemoveAttribute = useCallback((name: string) => {
    setExtraAttributes((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const onExtraAttributeChange = useCallback((name: string, value: string) => {
    setExtraAttributes((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handlePopupKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onApply();
      }
    },
    [closePopup, onApply],
  );

  return {
    addAttrName,
    anchor,
    availableAttributes,
    cert,
    closePopup,
    corrText,
    entityId,
    errorMessage,
    extraAttributes,
    handlePopupKeyDown,
    mode,
    onAddAttribute,
    onApply,
    onExtraAttributeChange,
    onRemoveAttribute,
    onRemoveMarkup,
    open,
    openPopup,
    setAddAttrName,
    setCert,
    setCorrText,
    sicText,
    typeLabel,
  };
};
