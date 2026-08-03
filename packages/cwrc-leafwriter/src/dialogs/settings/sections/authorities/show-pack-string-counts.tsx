import { List } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  persistAuthoritySettings,
  readPersistedAuthoritySettings,
} from '../../../../autoTagging/authoritySettings';
import { Toggler } from '../../components';

export const ShowPackStringCounts = () => {
  const { t } = useTranslation();
  const [value, setValue] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const projectPath = window.__leafWriterProject?.getProjectFilePath?.();
    setAvailable(Boolean(projectPath && window.electronAPI?.updateProjectFileConfig));
    setValue(readPersistedAuthoritySettings()?.showPackStringCounts === true);
  }, []);

  const handleChange = useCallback((checked: boolean) => {
    setValue(checked);
    const current = readPersistedAuthoritySettings() ?? {};
    void persistAuthoritySettings({ ...current, showPackStringCounts: checked });
  }, []);

  if (!available) return null;

  return (
    <List dense>
      <Toggler
        description={t('LW.settings.authorities.show_pack_string_counts_description')}
        icon="tags"
        onChange={handleChange}
        title={t('LW.settings.authorities.show_pack_string_counts')}
        type="toggle"
        value={value}
      />
    </List>
  );
};
