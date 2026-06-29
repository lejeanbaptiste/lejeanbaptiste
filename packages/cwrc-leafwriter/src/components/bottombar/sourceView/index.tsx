import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';

export const SourceView = () => {
  const { editorViewMode } = useAppState().ui;
  const actions = useActions();
  const { t } = useTranslation();

  const isSource = editorViewMode === 'source';

  const handleToggle = async () => {
    if (isSource) {
      await actions.ui.exitSourceMode();
    } else {
      await actions.ui.enterSourceMode();
    }
  };

  return (
    <Button
      onClick={() => void handleToggle()}
      size="small"
      sx={{ height: 28, textTransform: 'none', color: 'text.primary', minWidth: 0 }}
    >
      {isSource ? t('LW.view_mode_source') : t('LW.view_mode_visual')}
    </Button>
  );
};
