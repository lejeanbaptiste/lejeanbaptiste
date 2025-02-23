import FormatSizeIcon from '@mui/icons-material/FormatSize';
import { Box, ListItem, Slider, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';

export const FontSize = () => {
  const { fontSize: currentFontSize } = useAppState().editor;
  const { setFontSize } = useActions().editor;

  const { t } = useTranslation();

  return (
    <ListItem dense disableGutters>
      <FormatSizeIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
        {t('LW.settings.editor.font size')}
      </Typography>
      <Box flexGrow={1} />
      <Slider
        aria-label="Font Size"
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
