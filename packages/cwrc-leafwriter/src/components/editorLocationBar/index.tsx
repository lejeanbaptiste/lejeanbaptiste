import { Box, Typography, useTheme } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useAppState } from '../../overmind';
import { getTeiXPathAtOffset, getTeiXPathForEditorNode } from '../../utilities/teiXPath';

export const EDITOR_LOCATION_BAR_ID = 'editor-location-bar';

export const SOURCE_CURSOR_MOVED_EVENT = 'lw:source-cursor-moved';

export type SourceCursorMovedDetail = {
  offset: number;
};

export const EditorLocationBar = () => {
  const theme = useTheme();
  const { editorViewMode, sourceCurrentContent } = useAppState().ui;
  const [xpath, setXpath] = useState('');

  const updateFromVisual = useCallback((node?: Node) => {
    const target = node ?? window.writer?.editor?.currentNode;
    setXpath(getTeiXPathForEditorNode(target ?? null));
  }, []);

  const updateFromSource = useCallback(
    (offset: number) => {
      setXpath(getTeiXPathAtOffset(sourceCurrentContent, offset) ?? '');
    },
    [sourceCurrentContent],
  );

  useEffect(() => {
    const writer = window.writer;
    if (!writer) return;

    const onNodeChanged = (node?: Node) => {
      if (writer.overmindState?.ui?.editorViewMode !== 'visual') return;
      updateFromVisual(node);
    };

    const onDocumentLoaded = () => {
      if (writer.overmindState?.ui?.editorViewMode === 'visual') {
        updateFromVisual();
      }
    };

    writer.event('nodeChanged').subscribe(onNodeChanged);
    writer.event('documentLoaded').subscribe(onDocumentLoaded);

    if (editorViewMode === 'visual') {
      updateFromVisual();
    }

    return () => {
      writer.event('nodeChanged').unsubscribe(onNodeChanged);
      writer.event('documentLoaded').unsubscribe(onDocumentLoaded);
    };
  }, [editorViewMode, updateFromVisual]);

  useEffect(() => {
    const onSourceCursor = (event: Event) => {
      if (editorViewMode !== 'source') return;
      const detail = (event as CustomEvent<SourceCursorMovedDetail>).detail;
      if (typeof detail?.offset !== 'number') return;
      updateFromSource(detail.offset);
    };

    window.addEventListener(SOURCE_CURSOR_MOVED_EVENT, onSourceCursor);
    return () => window.removeEventListener(SOURCE_CURSOR_MOVED_EVENT, onSourceCursor);
  }, [editorViewMode, updateFromSource]);

  useEffect(() => {
    if (editorViewMode !== 'source') return;
    setXpath('');
    requestAnimationFrame(() => {
      window.writer?.layoutManager?.resizeEditorChrome?.();
    });
  }, [editorViewMode]);

  useEffect(() => {
    requestAnimationFrame(() => {
      window.writer?.layoutManager?.resizeEditorChrome?.();
    });
  }, [xpath]);

  return (
    <Box
      id={EDITOR_LOCATION_BAR_ID}
      sx={[
        {
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          flexShrink: 0,
          minHeight: 22,
          overflow: 'hidden',
          px: 1,
          py: 0.25,
          width: '100%',
        },
        (t) =>
          t.applyStyles('dark', {
            bgcolor: t.vars.palette.background.paper,
          }),
        {
          bgcolor: '#fafafa',
        },
      ]}
    >
      <Typography
        aria-live="polite"
        component="div"
        sx={{
          color: xpath ? 'text.secondary' : 'text.disabled',
          fontFamily: theme.typography.fontFamily,
          fontSize: '0.75rem',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
        title={xpath || undefined}
        variant="caption"
      >
        {xpath || '—'}
      </Typography>
    </Box>
  );
};
