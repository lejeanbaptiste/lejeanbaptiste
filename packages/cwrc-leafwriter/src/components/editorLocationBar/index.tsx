import { Box, Typography, useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../../overmind';
import {
  getTeiXPathAtOffset,
  getTeiXPathForEditorNode,
  parseTeiXPathToBreadcrumbSegments,
} from '../../utilities/teiXPath';
import { jumpToTeiXPath } from './jumpToTeiXPath';

export const EDITOR_LOCATION_BAR_ID = 'editor-location-bar';

export const SOURCE_CURSOR_MOVED_EVENT = 'lw:source-cursor-moved';

export type SourceCursorMovedDetail = {
  offset: number;
};

const XPathBreadcrumb = ({
  xpath,
  onSegmentClick,
}: {
  xpath: string;
  onSegmentClick: (segmentXpath: string) => void;
}) => {
  const theme = useTheme();
  const segments = useMemo(() => parseTeiXPathToBreadcrumbSegments(xpath), [xpath]);

  if (segments.length === 0) return null;

  const captionStyles = {
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.75rem',
    lineHeight: 1.4,
  };

  return (
    <Box
      aria-label="Document location"
      component="nav"
      sx={{
        alignItems: 'center',
        display: 'flex',
        minWidth: 0,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {segments.map((segment, index) => {
        const isCurrent = index === segments.length - 1;

        return (
          <Box
            key={segment.xpath}
            sx={{
              alignItems: 'center',
              display: 'inline-flex',
              flexShrink: index === segments.length - 1 ? 1 : 0,
              minWidth: 0,
            }}
          >
            {index > 0 && (
              <Typography
                aria-hidden
                component="span"
                sx={{
                  ...captionStyles,
                  color: 'text.disabled',
                  flexShrink: 0,
                  mx: 0.25,
                  userSelect: 'none',
                }}
                variant="caption"
              >
                /
              </Typography>
            )}
            <Box
              aria-current={isCurrent ? 'location' : undefined}
              aria-label={`Go to ${segment.label}`}
              component="button"
              onClick={() => onSegmentClick(segment.xpath)}
              sx={{
                ...captionStyles,
                background: 'none',
                border: 'none',
                borderRadius: 0.5,
                color: isCurrent ? 'text.primary' : 'text.secondary',
                cursor: 'pointer',
                flexShrink: index === segments.length - 1 ? 1 : 0,
                font: 'inherit',
                minWidth: 0,
                overflow: 'hidden',
                p: 0,
                textAlign: 'left',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 1,
                },
              }}
              title={segment.xpath}
              type="button"
            >
              {segment.label}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
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

  const handleSegmentClick = useCallback((segmentXpath: string) => {
    jumpToTeiXPath(segmentXpath, true);
  }, []);

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
      {xpath ? (
        <XPathBreadcrumb onSegmentClick={handleSegmentClick} xpath={xpath} />
      ) : (
        <Typography
          aria-live="polite"
          component="div"
          sx={{
            color: 'text.disabled',
            fontFamily: theme.typography.fontFamily,
            fontSize: '0.75rem',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
          variant="caption"
        >
          —
        </Typography>
      )}
    </Box>
  );
};
