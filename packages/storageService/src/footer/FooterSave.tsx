import DownloadIcon from '@mui/icons-material/Download';
import { LoadingButton } from '@mui/lab';
import { Box, Button, DialogActions, IconButton, useMediaQuery, useTheme } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';
import SaveOptions from './SaveOptions';

export interface Props {
  onCancel: () => void;
}

export const FooterSave = ({ onCancel }: Props) => {
  const { t } = useTranslation();
  const { resource } = useAppState().common;
  const { isSaving, owner, repository } = useAppState().cloud;
  const { download } = useActions().common;
  const { checkRepoUserWritenPermission, getProvider, saveAspullRequest, saveDocument } =
    useActions().cloud;
  const [saveEnabled, setSaveEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (!repository) {
      setSaveEnabled(false);
      return;
    }
    checkPermissions();
  }, [repository]);

  const checkPermissions = async () => {
    setSaveEnabled(true);
    const provider = getProvider();
    if (!provider) return setHasPermission(false);

    if (provider.username === owner?.username) return setHasPermission(true);
    const _hasPermission = await checkRepoUserWritenPermission();
    setHasPermission(_hasPermission);
  };

  const handleClickSave = (value: string) => {
    save(value);
  };

  const save = async (value: string) => {
    if (value === 'save') return saveDocument();

    const crossOrigin = value === 'forkPullRequest' ? true : false;
    await saveAspullRequest(crossOrigin);
  };

  const handleDownload = () => download();

  return (
    <DialogActions data-testid="save:footer" sx={{ justifyContent: 'space-between' }}>
      <Button onClick={onCancel} title="cancel" variant="outlined">
        {t('commons:cancel')}
      </Button>
      <Box flexGrow={1} />
      {isSM ? (
        <IconButton disabled={isSaving} onClick={handleDownload}>
          <DownloadIcon />
        </IconButton>
      ) : (
        <Button
          disabled={isSaving}
          onClick={handleDownload}
          startIcon={<DownloadIcon />}
          title="download"
          variant="outlined"
        >
          {t('footer:download')}
        </Button>
      )}
      {repository && !hasPermission ? (
        <LoadingButton
          disabled={!saveEnabled || resource?.filename === ''}
          loading={isSaving}
          onClick={() => handleClickSave('forkPullRequest')}
        >
          {t('footer:fork_and_pull_request')}
        </LoadingButton>
      ) : (
        <SaveOptions enabled={saveEnabled} onSelect={handleClickSave} />
      )}
    </DialogActions>
  );
};
