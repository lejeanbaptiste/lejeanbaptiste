import { List } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import { Toggler } from '../../components';
import { FontFamily } from './font-family';
import { FontSize } from './font-size';

export const Editor = () => {
  const { stripCjkWhitespace } = useAppState().editor;
  const { setStripCjkWhitespace } = useActions().editor;
  const { t } = useTranslation();

  return (
    <List dense>
      <FontSize />
      <FontFamily />
      <Toggler
        icon="translate"
        onChange={setStripCjkWhitespace}
        title={t('LW.settings.editor.strip_east_asian_whitespace')}
        type="toggle"
        value={stripCjkWhitespace}
      />
    </List>
  );
};
