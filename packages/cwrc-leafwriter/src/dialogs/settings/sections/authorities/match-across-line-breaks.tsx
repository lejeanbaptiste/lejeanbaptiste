import { List } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  persistAuthoritySettings,
  readPersistedAuthoritySettings,
} from '../../../../autoTagging/authoritySettings';
import { Toggler } from '../../components';

export const MatchAcrossLineBreaks = () => {
  const { t } = useTranslation();
  const [value, setValue] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const projectPath = window.__leafWriterProject?.getProjectFilePath?.();
    setAvailable(Boolean(projectPath && window.electronAPI?.updateProjectFileConfig));
    setValue(readPersistedAuthoritySettings()?.matchAcrossLineBreaks === true);
  }, []);

  const handleChange = useCallback((checked: boolean) => {
    setValue(checked);
    const current = readPersistedAuthoritySettings() ?? {};
    void persistAuthoritySettings({ ...current, matchAcrossLineBreaks: checked });
  }, []);

  if (!available) return null;

  return (
    <List dense>
      <Toggler
        description={t('LW.settings.authorities.match_across_line_breaks_description')}
        icon="insertTag"
        onChange={handleChange}
        title={t('LW.settings.authorities.match_across_line_breaks')}
        type="toggle"
        value={value}
      />
    </List>
  );
};
