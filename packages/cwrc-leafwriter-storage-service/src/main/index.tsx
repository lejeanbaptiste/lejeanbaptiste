import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  Slide,
  SlideProps,
  Stack,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { forwardRef, useEffect, useState } from 'react';
import { CloudDialog } from '../cloud';
import { FooterLoad, FooterSave } from '../footer';
import { Header } from '../header';
import { useDialog } from '../hooks/useDialog';
import { PastePanel, UploadPanel } from '../local';
import { useActions, useAppState } from '../overmind';
import { SourcePanel } from '../source-panel';
import type { Resource, StorageDialogProps } from '../types';
import { UrlPanel } from '../url-panel';

const HEIGHT = 600;

const Transition = forwardRef((props: SlideProps, ref) => (
  <Slide direction="down" ref={ref} {...props} />
));
Transition.displayName = 'DialogTransition';

export const Main = ({
  config,
  headerLabel,
  onBackdropClick,
  onCancel,
  onChange,
  onLoad,
  onSave,
  open = false,
  resource: originResource,
  source: originSource,
  type = 'load',
}: StorageDialogProps) => {
  const { cloud } = useAppState();
  const { resource, submit, source } = useAppState().common;

  const { initialize } = useActions().cloud;
  const { clearSubmit, configure, resetAll, setDialogType } = useActions().common;

  useDialog();

  const [isLoading, setIsLoading] = useState(true);

  const { breakpoints } = useTheme();
  const isMD = useMediaQuery(breakpoints.down('md'));

  useEffect(() => {
    setDialogType(type);
    init();
  }, []);

  useEffect(() => {
    if (type === 'save') return;
    if (!onChange) return;

    if (source !== 'cloud') {
      onChange(resource);
      return;
    }

    //else "cloud"
    if (!cloud.owner) return;
    const changeObject: Resource = {
      provider: cloud.name,
      ownerType: cloud.owner.type,
      owner: cloud.name === 'gitlab' ? cloud.owner.id : cloud.owner.username,
      repo: cloud.name === 'gitlab' ? cloud.repository?.id : cloud.repository?.name,
      path: cloud.repositoryContent.path?.join('/'),
      filename: resource?.filename,
      storageSource: resource?.storageSource,
    };
    onChange(changeObject);
  }, [
    cloud.name,
    cloud.owner,
    cloud.repository,
    cloud.repositoryContent.path,
    resource,
    resource?.url,
    source,
  ]);

  useEffect(() => {
    const resource: Resource = { ...submit?.resource };
    if (submit?.action === 'load' && onLoad) onLoad(resource);
    if (submit?.action === 'save' && onSave) onSave(resource);
    clearSubmit();
  }, [submit]);

  const init = async () => {
    await configure(config);
    await initialize({ source: originSource, resource: originResource });
    setIsLoading(false);
  };

  const close = () => {
    resetAll();
    onCancel && onCancel();
  };

  const handleClose = async (_event: MouseEvent, reason: string) => {
    if (type === 'save') return;
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      if (onBackdropClick) {
        await resetAll();
        onBackdropClick();
      }
    }
  };

  return (
    <Dialog
      data-testid="storage-dialog"
      fullScreen={isMD}
      fullWidth
      maxWidth="md"
      onClose={handleClose}
      open={open}
      TransitionComponent={Transition}
    >
      <Box role="panel" height={isMD ? '100vh' : HEIGHT}>
        <Stack direction="row" height="100%">
          <SourcePanel />
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" width="100%">
              <CircularProgress />
            </Box>
          ) : (
            <Stack height="100%" width="100%">
              <Header label={headerLabel} />
              <DialogContent
                dividers
                sx={{ p: 0, overflowY: source === 'paste' ? 'auto' : 'hidden' }}
              >
                {type === 'save' ? (
                  cloud.providers.length > 0 && <CloudDialog />
                ) : (
                  <>
                    {source === 'paste' ? (
                      <PastePanel />
                    ) : source === 'local' ? (
                      <UploadPanel />
                    ) : source === 'url' ? (
                      <UrlPanel />
                    ) : (
                      source === 'cloud' && <CloudDialog />
                    )}
                  </>
                )}
              </DialogContent>

              {type === 'save' ? <FooterSave onCancel={close} /> : <FooterLoad onCancel={close} />}
            </Stack>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
};
