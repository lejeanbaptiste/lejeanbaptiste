import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import { Toggler } from '../components';

export const MarkupPanel = () => {
  const { markupPanel: structurePanel } = useAppState().ui;
  const { allowTagDragAndDrop, showTextNodes } = useActions().ui;
  const { t } = useTranslation();

  return (
    <>
      <Toggler
        description={`${t('LW.Text Nodes must be displayed for better accuracy').toString()} (${t(
          'LW.experimental',
        )})`}
        disabled={!structurePanel.showTextNodes}
        icon="dragAndDrop"
        onChange={allowTagDragAndDrop}
        title={t('LW.Allow drag and drop')}
        value={structurePanel.allowDragAndDrop}
      />
      <Toggler
        description={`(${t('LW.beta')}) ${t('LW.Some features are not fully implemented')} ${t(
          'LW.It can produce unexpected results or make LEAF-Writer crash',
        )} ${t('LW.Use with caution')}`}
        icon="textNode"
        onChange={showTextNodes}
        title={t('LW.Show Text Nodes')}
        type="toggle"
        value={structurePanel.showTextNodes}
      />
    </>
  );
};
