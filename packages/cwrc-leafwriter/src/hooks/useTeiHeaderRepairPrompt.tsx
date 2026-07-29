import { Alert, Stack, Typography } from '@mui/material';
import type { ValidationError, ValidationResponse } from '@cwrc/leafwriter-validator';
import { useEffect, useRef } from 'react';
import { useActions, useAppState } from '../overmind';
import { fetchResourceText } from '../utilities/fetchResource';
import { repairTeiHeader } from '../services/teiHeaderRepair';
import type Writer from '../js/Writer';
import type { EditorViewMode } from '../overmind/ui/state';

type ValidationResult = ValidationResponse & { schemaUnavailable?: boolean; parseError?: unknown };

export const useTeiHeaderRepairPrompt = (writer: Writer | null) => {
  const actions = useActions();
  const editorViewMode = (useAppState().ui as { editorViewMode: EditorViewMode }).editorViewMode;
  const editorViewModeRef = useRef(editorViewMode);
  editorViewModeRef.current = editorViewMode;
  const openValidationRef = useRef(false);
  const promptingRef = useRef(false);

  useEffect(() => {
    if (!writer) return;

    const onLoaded = (success: boolean) => {
      openValidationRef.current = success;
    };
    const onValidated = async (valid: boolean, result: ValidationResult, xml?: string) => {
      if (!openValidationRef.current || valid || !xml || promptingRef.current) return;
      openValidationRef.current = false;
      if (result.schemaUnavailable || result.parseError || !result.errors?.length) return;

      const headerError = result.errors.some((error: ValidationError) => {
        const path = error.element?.xpath ?? error.target?.xpath ?? '';
        return path.includes('/teiHeader[') || path.includes('/teiHeader/');
      });
      if (!headerError) return;

      const schemaUrl =
        writer.schemaManager.getRng() ?? writer.schemaManager.getCurrentDocumentSchemaUrl();
      if (!schemaUrl) return;
      const schemaText = await fetchResourceText(schemaUrl);
      if (!schemaText) return;
      const repair = repairTeiHeader(xml, schemaText);
      if (!repair) return;

      promptingRef.current = true;
      actions.ui.openDialog({
        type: 'simple',
        props: {
          maxWidth: 'sm',
          severity: 'warning',
          title: 'TEI header repair available',
          Body: () => (
            <Stack spacing={1}>
              <Typography>A known schema-linked repair is available for this file.</Typography>
              <Alert severity="info">{repair.description}</Alert>
              <Typography variant="body2">
                Only the TEI header will be changed. The document will be validated again after
                repair.
              </Typography>
            </Stack>
          ),
          actions: [
            { action: 'leave', label: 'Leave unchanged' },
            { action: 'repair', label: 'Repair', variant: 'contained' },
          ],
          onClose: async (action) => {
            try {
              if (action !== 'repair') return;
              if (editorViewModeRef.current === 'source') {
                actions.ui.setSourceCurrentContent(repair.repairedXml);
              } else {
                // Desktop visual mode validates by merging the body with the
                // separately stored header. Updating the editor DOM alone is
                // not enough: the next validation would reattach the stale
                // header and immediately resurrect the same error.
                window.__desktopStoredDocumentXml = repair.repairedXml;
                actions.document.updateXMLHeader(repair.repairedXml);
                actions.document.setDocumentXml(repair.repairedXml);
              }
              await actions.validator.validate();
            } finally {
              promptingRef.current = false;
            }
          },
        },
      });
    };

    writer.event('documentLoaded').subscribe(onLoaded);
    writer.event('documentValidated').subscribe(onValidated);
    if (writer.isDocLoaded) {
      openValidationRef.current = true;
      void actions.validator.validate();
    }
    return () => {
      writer.event('documentLoaded').unsubscribe(onLoaded);
      writer.event('documentValidated').unsubscribe(onValidated);
    };
  }, [actions, writer]);
};
