import { List } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import { Toggler } from '../../components';
import { FontSize } from './font-size';

export const Editor = () => {
  const { autosave, isReadonly, showEntities } = useAppState().editor;
  const { setAutosave, setShowEntities } = useActions().editor;
  const { t } = useTranslation();

  return (
    <List dense>
      <FontSize />
      {autosave !== undefined && !isReadonly && (
        <Toggler
          icon="cloudSync"
          onChange={setAutosave}
          title={t('LW.commons.autosave')}
          type="toggle"
          value={autosave}
        />
      )}
      <Toggler
        icon="entitiesTag"
        onChange={setShowEntities}
        title={t('LW.settings.editor.Show Entities')}
        type="toggle"
        value={showEntities}
      />
    </List>
  );
};
