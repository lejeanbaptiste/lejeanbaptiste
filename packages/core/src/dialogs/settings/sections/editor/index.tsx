import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import { Toggler } from '../../components';
import { FontSize } from './FontSize';

export const Editor = () => {
  const { autosave, isReadonly, showEntities } = useAppState().editor;
  const { setAutosave, setShowEntities } = useActions().editor;
  const { t } = useTranslation();

  return (
    <>
      <FontSize />
      {autosave !== undefined && !isReadonly && (
        <Toggler
          icon="cloudSync"
          onChange={setAutosave}
          title={t('autosave')}
          type="toggle"
          value={autosave}
        />
      )}
      <Toggler
        icon="entitiesTag"
        onChange={setShowEntities}
        title={t('Show Entities')}
        type="toggle"
        value={showEntities}
      />
    </>
  );
};
