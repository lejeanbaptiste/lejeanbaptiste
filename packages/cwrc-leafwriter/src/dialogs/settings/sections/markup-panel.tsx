import { List } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import { Toggler } from '../components';

export const MarkupPanel = () => {
  const { markupPanel: structurePanel } = useAppState().ui;
  const { allowTagDragAndDrop, showTextNodes } = useActions().ui;
  const { t } = useTranslation();

  return (
    <List dense>
      <Toggler
        description={`${t('LW.settings.markupPanel.message.Text Nodes must be displayed for better accuracy').toString()} (${t(
          'LW.commons.experimental',
        )})`}
        disabled={!structurePanel.showTextNodes}
        icon="dragAndDrop"
        onChange={allowTagDragAndDrop}
        title={t('LW.settings.markupPanel.Allow drag and drop')}
        value={structurePanel.allowDragAndDrop}
      />
      <Toggler
        description={`(${t('LW.commons.beta')}): ${t('LW.messages.Some features are not fully implemented')}. ${t(
          'LW.messages.It can produce unexpected results or make LEAF-Writer crash',
        )}. ${t('LW.messages.Use with caution')}.`}
        icon="textNode"
        onChange={showTextNodes}
        title={t('LW.settings.markupPanel.Show Text Nodes')}
        type="toggle"
        value={structurePanel.showTextNodes}
      />
    </List>
  );
};
