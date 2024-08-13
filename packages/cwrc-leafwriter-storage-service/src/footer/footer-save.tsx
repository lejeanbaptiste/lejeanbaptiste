import { LoadingButton } from '@mui/lab';
import { Box, Button, DialogActions, Icon, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getIcon } from '../icons';
import { useActions, useAppState } from '../overmind';
import { SaveOptions } from './components/save-options';

export interface Props {
  onCancel: () => void;
}

export const FooterSave = ({ onCancel }: Props) => {
  const { resource } = useAppState().common;
  const { isSaving, owner, repository } = useAppState().cloud;

  const { download } = useActions().common;
  const { checkRepoUserWritenPermission, getProvider, saveAspullRequest, saveDocument } =
    useActions().cloud;

  const { t } = useTranslation();

  const [saveEnabled, setSaveEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);

  const { breakpoints } = useTheme();
  const isSM = useMediaQuery(breakpoints.down('sm'));

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

  const handleClickSave = (value: string) => save(value);

  const save = async (value: string) => {
    if (value === 'save') return saveDocument();

    const crossOrigin = value === 'forkPullRequest' ? true : false;
    await saveAspullRequest(crossOrigin);
  };

  const handleDownload = () => download();

  return (
    <DialogActions data-testid="save:footer" sx={{ justifyContent: 'space-between' }}>
      <Button onClick={onCancel} size="small" title="cancel">
        {t('SS.commons.cancel')}
      </Button>
      <Box flexGrow={1} />
      {isSM ? (
        <IconButton disabled={isSaving} onClick={handleDownload} size="small">
          <Icon component={getIcon('download')} />
        </IconButton>
      ) : (
        <Button
          disabled={isSaving}
          onClick={handleDownload}
          size="small"
          startIcon={<Icon component={getIcon('download')} />}
          title="download"
        >
          {t('SS.footer.download')}
        </Button>
      )}
      {repository && !hasPermission ? (
        <LoadingButton
          disabled={!saveEnabled || resource?.filename === ''}
          loading={isSaving}
          onClick={() => handleClickSave('forkPullRequest')}
          size="small"
        >
          {t('SS.footer.fork_and_pull_request')}
        </LoadingButton>
      ) : (
        <SaveOptions enabled={saveEnabled} onSelect={handleClickSave} />
      )}
    </DialogActions>
  );
};
