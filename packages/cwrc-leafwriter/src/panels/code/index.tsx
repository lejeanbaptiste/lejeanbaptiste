import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Button, Paper, Stack, ToggleButton, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../overmind';
import { Editor } from './Editor';

export const CodePanel = () => {
  const actions = useActions();

  const { t } = useTranslation();

  const [showLOD, setShowLOD] = useState(false);

  const handleClickEditXml = async () => {
    await actions.ui.enterSourceMode();
  };

  const handleClickShowLODAnnotation = () => setShowLOD(!showLOD);

  return (
    <Paper
      id="code-panel"
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack direction="column" gap={1}>
        <Editor showLOD={showLOD} />
        <Stack direction="row" justifyContent="space-between">
          <Tooltip enterDelay={1000} title={t('LW.show_lod_annotation')}>
            <ToggleButton
              color="secondary"
              onChange={handleClickShowLODAnnotation}
              selected={showLOD}
              size="small"
              sx={{ height: 28 }}
              value="check"
            >
              <ChangeHistoryIcon fontSize="inherit" sx={{ transform: 'rotate(27deg)' }} />
            </ToggleButton>
          </Tooltip>
          <Tooltip enterDelay={1000} title={t('LW.edit_raw_xml')}>
            <Button onClick={handleClickEditXml} size="small" sx={{ height: 28 }}>
              {t('LW.commons.edit')}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
};
