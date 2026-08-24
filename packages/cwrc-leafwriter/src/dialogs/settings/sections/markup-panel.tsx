import { FormControl, FormHelperText, InputLabel, List, MenuItem, Select } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import { Toggler } from '../components';

export const MarkupPanel = () => {
  const { markupPanel: structurePanel } = useAppState().ui;
  const { allowTagDragAndDrop, setMarkupTreeSyncMode, showTextNodes } = useActions().ui;
  const { t } = useTranslation();

  return (
    <List dense>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel id="markup-tree-sync-mode-label">
          {t('LW.settings.markupPanel.Tree synchronization')}
        </InputLabel>
        <Select
          label={t('LW.settings.markupPanel.Tree synchronization')}
          labelId="markup-tree-sync-mode-label"
          onChange={(event) =>
            setMarkupTreeSyncMode(event.target.value as 'live' | 'manual' | 'off')
          }
          value={structurePanel.syncMode}
        >
          <MenuItem value="live">{t('LW.settings.markupPanel.Live')}</MenuItem>
          <MenuItem value="manual">{t('LW.settings.markupPanel.On demand')}</MenuItem>
          <MenuItem value="off">{t('LW.settings.markupPanel.Off')}</MenuItem>
        </Select>
        <FormHelperText>
          {t('LW.settings.markupPanel.Tree synchronization description')}
        </FormHelperText>
      </FormControl>
      <Toggler
        description={`${t('LW.settings.markupPanel.message.Text Nodes must be displayed for better accuracy')} (${t('LW.commons.experimental')})`}
        disabled={!structurePanel.showTextNodes}
        icon="dragAndDrop"
        onChange={allowTagDragAndDrop}
        title={t('LW.settings.markupPanel.Allow drag and drop')}
        value={structurePanel.allowDragAndDrop}
      />
      <Toggler
        description={`(${t('LW.commons.beta')}): ${t('LW.messages.some_features_are_not_fully_implemented')}. ${t(
          'LW.messages.it_can_produce_unexpected_results_or_make_leaf_writer_crash',
        )}. ${t('LW.messages.use_with_caution')}.`}
        icon="textNode"
        onChange={showTextNodes}
        title={t('LW.settings.markupPanel.Show Text Nodes')}
        type="toggle"
        value={structurePanel.showTextNodes}
      />
    </List>
  );
};
