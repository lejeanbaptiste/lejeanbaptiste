import { Button, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { shouldOpenTeiInSourceMode } from '../../../utilities/teiMilestoneHeuristics';
import { useActions, useAppState } from '../../../overmind';

export const SourceView = () => {
  const { editorViewMode, sourceCurrentContent } = useAppState().ui;
  const { url: documentUrl } = useAppState().document;
  const actions = useActions();
  const { t } = useTranslation();

  const isSource = editorViewMode === 'source';
  const visualLocked =
    isSource &&
    shouldOpenTeiInSourceMode(
      sourceCurrentContent || window.__desktopStoredDocumentXml || '',
      documentUrl,
    );

  const handleToggle = async () => {
    if (visualLocked) return;
    if (isSource) {
      await actions.ui.exitSourceMode();
    } else {
      await actions.ui.enterSourceMode();
    }
  };

  const button = (
    <Button
      onClick={() => void handleToggle()}
      size="small"
      disabled={visualLocked}
      sx={{ height: 28, textTransform: 'none', color: 'text.primary', minWidth: 0 }}
    >
      {isSource ? t('LW.view_mode_source') : t('LW.view_mode_visual')}
    </Button>
  );

  if (!visualLocked) return button;

  return (
    <Tooltip title={t('LW.view_mode_visual_locked_hint')} placement="top">
      <span>{button}</span>
    </Tooltip>
  );
};
