import type { ValidationResponse } from '@cwrc/leafwriter-validator';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useRef, useState } from 'react';
import { useActions, useAppState } from '../../overmind';
import {
  mapValidationErrorsToMarkers,
  mapWellFormednessToMarkers,
} from '../../utilities/mapValidationToEditorMarkers';
import type { XMLValidity } from '../../utilities/checkWellFormedness';

const AUTO_VALIDATE_DELAY_MS = 2000;

type ValidationResult = ValidationResponse & {
  parseError?: Extract<XMLValidity, { valid: false }>['error'];
};

export const useSourceValidation = () => {
  const { sourceCurrentContent, editorViewMode } = useAppState().ui;
  const actions = useActions();
  const [markers, setMarkers] = useState<monaco.editor.IMarkerData[]>([]);
  const contentRef = useRef(sourceCurrentContent);

  contentRef.current = sourceCurrentContent;

  useEffect(() => {
    if (editorViewMode !== 'source') {
      setMarkers([]);
      return;
    }

    let canceled = false;
    let timer: number | undefined;
    let writer = window.writer;

    const onValidated = (_valid: boolean, result: ValidationResult) => {
      if (result.parseError) {
        setMarkers(
          mapWellFormednessToMarkers({
            valid: false,
            error: result.parseError,
          }),
        );
        return;
      }

      if (!result.errors?.length) {
        setMarkers([]);
        return;
      }

      setMarkers(mapValidationErrorsToMarkers(contentRef.current, result.errors));
    };

    const subscribe = () => {
      if (canceled) return;
      writer = window.writer;
      if (!writer) {
        timer = window.setTimeout(subscribe, 100);
        return;
      }

      writer.event('documentValidated').subscribe(onValidated);
    };

    subscribe();

    return () => {
      canceled = true;
      if (timer) window.clearTimeout(timer);
      if (writer) writer.event('documentValidated').unsubscribe(onValidated);
      setMarkers([]);
    };
  }, [editorViewMode]);

  useEffect(() => {
    if (editorViewMode !== 'source') return;

    void actions.validator.validate();

    const timer = setTimeout(() => {
      void actions.validator.validate();
    }, AUTO_VALIDATE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [editorViewMode, sourceCurrentContent]);

  return { markers };
};
