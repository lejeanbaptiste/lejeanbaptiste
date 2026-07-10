import FormatSizeIcon from '@mui/icons-material/FormatSize';
import { Box, ListItem, Slider, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getUiZoom,
  isUiZoomAvailable,
  setUiZoom,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
} from '../../../../js/uiZoom';
import { useActions, useAppState } from '../../../../overmind';

/** Desktop: scales the whole interface (webFrame zoom). Document/pane text has its own Cmd+/− zoom. */
const InterfaceZoom = () => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(() => getUiZoom());

  return (
    <ListItem dense disableGutters>
      <FormatSizeIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography variant="body2">{t('LW.settings.editor.interface_zoom')}</Typography>
      <Box flexGrow={1} />
      <Slider
        aria-label={t('LW.settings.editor.interface_zoom_slider')}
        getAriaLabel={(val) => `${val}%`}
        getAriaValueText={(val) => `${val}%`}
        marks
        min={UI_ZOOM_MIN}
        max={UI_ZOOM_MAX}
        onChange={(_event, val) => {
          setZoom(val as number);
          setUiZoom(val as number);
        }}
        shiftStep={5}
        size="small"
        step={5}
        value={zoom}
        valueLabelDisplay="on"
        sx={{ width: 200 }}
      />
    </ListItem>
  );
};

/** Web: document text size in the visual editor (no webFrame available). */
const DocumentFontSize = () => {
  const { fontSize: currentFontSize } = useAppState().editor;
  const { setFontSize } = useActions().editor;

  const { t } = useTranslation();

  return (
    <ListItem dense disableGutters>
      <FormatSizeIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography variant="body2">
        {t('LW.settings.editor.font_size')}
      </Typography>
      <Box flexGrow={1} />
      <Slider
        aria-label={t('LW.settings.editor.font_size_slider')}
        getAriaLabel={(val) => `${val} pt`}
        getAriaValueText={(val) => `${val} pt`}
        marks
        min={8}
        max={20}
        onChange={(_event, val) => setFontSize(val as number)}
        shiftStep={1}
        size="small"
        step={1}
        value={currentFontSize}
        valueLabelDisplay="on"
        sx={{ width: 200 }}
      />
    </ListItem>
  );
};

export const FontSize = () => (isUiZoomAvailable() ? <InterfaceZoom /> : <DocumentFontSize />);
