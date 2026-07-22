import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { IconButton, Stack, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../../overmind';

/**
 * Visual (TinyMCE) and source (Monaco) each keep their own independent zoom
 * level - see editorZoom.ts and fontSizeZoom.ts - each publishing the same
 * {zoomIn, zoomOut, reset, get} shape on window while its editor is mounted.
 * These buttons just forward to whichever bridge matches the active mode.
 */
export const EditorZoomControls = () => {
  const { editorViewMode } = useAppState().ui;
  const { t } = useTranslation();

  const isSource = editorViewMode === 'source';

  const handleZoomIn = () => {
    if (isSource) window.__leafWriterSourceZoom?.zoomIn();
    else window.__leafWriterEditorZoom?.zoomIn();
  };

  const handleZoomOut = () => {
    if (isSource) window.__leafWriterSourceZoom?.zoomOut();
    else window.__leafWriterEditorZoom?.zoomOut();
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0} sx={{ flexShrink: 0 }}>
      <Tooltip title={t('LW.zoom_out')}>
        <IconButton
          aria-label={t('LW.zoom_out')}
          onClick={handleZoomOut}
          size="small"
          sx={{ color: 'text.disabled', p: 0.125 }}
        >
          <ZoomOutIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('LW.zoom_in')}>
        <IconButton
          aria-label={t('LW.zoom_in')}
          onClick={handleZoomIn}
          size="small"
          sx={{ color: 'text.disabled', p: 0.125 }}
        >
          <ZoomInIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
