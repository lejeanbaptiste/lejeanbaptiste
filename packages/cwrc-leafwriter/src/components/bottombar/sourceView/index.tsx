import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import type { EditorViewMode } from '../../../overmind/ui/state';

export const SourceView = () => {
  const { editorViewMode } = useAppState().ui;
  const actions = useActions();
  const { t } = useTranslation();

  const handleChange = async (
    _event: MouseEvent<HTMLElement>,
    value: EditorViewMode | null,
  ) => {
    if (!value) return;

    if (value === 'source') {
      await actions.ui.enterSourceMode();
      return;
    }

    if (value === editorViewMode) return;

    await actions.ui.exitSourceMode();
  };

  return (
    <ToggleButtonGroup
      exclusive
      onChange={handleChange}
      size="small"
      value={editorViewMode}
    >
      <ToggleButton sx={{ height: 28, textTransform: 'none' }} value="visual">
        {t('LW.view_mode_visual')}
      </ToggleButton>
      <ToggleButton sx={{ height: 28, textTransform: 'none' }} value="source">
        {t('LW.view_mode_source')}
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
