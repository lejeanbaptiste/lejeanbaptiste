import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import { Toggler } from '../components';

export const MarkupPanel = () => {
  const { markupPanel: structurePanel } = useAppState().ui;
  const { allowTagDragAndDrop, showTextNodes } = useActions().ui;
  const { t } = useTranslation('leafwriter');

  return (
    <>
      <Toggler
        description={`${t('Text Nodes must be displayed for better accuracy').toString()} (${t(
          'experimental',
        )})`}
        disabled={!structurePanel.showTextNodes}
        icon="dragAndDrop"
        onChange={allowTagDragAndDrop}
        title={t('Allow drag and drop')}
        value={structurePanel.allowDragAndDrop}
      />
      <Toggler
        description={`(${t('beta')}) ${t('Some features are not fully implemented')} ${t(
          'It can produce unexpected results or make LEAF-Writer crash',
        )} ${t('Use with caution')}`}
        icon="textNode"
        onChange={showTextNodes}
        title={t('Show Text Nodes')}
        type="toggle"
        value={structurePanel.showTextNodes}
      />
    </>
  );
};
