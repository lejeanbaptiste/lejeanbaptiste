import { Button, Paper, Stack, ToggleButton, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TbVectorTriangle } from 'react-icons/tb';
import { useActions } from '../../overmind';
import { Editor } from './Editor';

export const CodePanel = () => {
  const { openDialog } = useActions().ui;
  const { writer } = window;

  const { t } = useTranslation();

  const [showLOD, setShowLOD] = useState(false);

  const handleClickEditXml = async () => {
    const docText = await writer.converter.getDocumentContent(true);
    if (!docText) return;
    openDialog({ type: 'editSource', props: { content: docText } });
  };

  const handleClickShowLODAnnotation = () => setShowLOD(!showLOD);

  return (
    <Paper
      id="code-panel"
      elevation={5}
      square
      sx={[
        {
          overflow: 'auto',
          height: '100%',
          p: 1,
          backgroundColor: '#f5f5f5',
        },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: theme.vars.palette.background.paper,
          }),
      ]}
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
              <TbVectorTriangle fontSize="inherit" style={{ transform: 'rotate(27deg)' }} />
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
