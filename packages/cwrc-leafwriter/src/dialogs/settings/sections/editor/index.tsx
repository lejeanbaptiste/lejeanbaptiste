import { List } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import { Toggler } from '../../components';
import { FontFamily } from './font-family';
import { FontSize } from './font-size';

export const Editor = () => {
  const { showEntities, stripCjkWhitespace, validateXmlOnReplace } = useAppState().editor;
  const { setShowEntities, setStripCjkWhitespace, setValidateXmlOnReplace } = useActions().editor;
  const { t } = useTranslation();

  return (
    <List dense>
      <FontSize />
      <FontFamily />
      <Toggler
        icon="entitiesTag"
        onChange={setShowEntities}
        title={t('LW.settings.editor.show_entities')}
        type="toggle"
        value={showEntities}
      />
      <Toggler
        icon="translate"
        onChange={setStripCjkWhitespace}
        title={t('LW.settings.editor.strip_east_asian_whitespace')}
        type="toggle"
        value={stripCjkWhitespace}
      />
      <Toggler
        description={t('LW.settings.editor.validate_xml_on_replace_description')}
        icon="correction"
        onChange={setValidateXmlOnReplace}
        title={t('LW.settings.editor.validate_xml_on_replace')}
        type="toggle"
        value={validateXmlOnReplace}
      />
    </List>
  );
};
