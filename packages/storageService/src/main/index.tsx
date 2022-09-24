import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  Slide,
  SlideProps,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { forwardRef, useEffect, useState, type FC } from 'react';
import CloudDialog from '../cloud';
import { FooterLoad, FooterSave } from '../footer';
import Header from '../header';
import { useDialog } from '../hooks/useDialog';
import { PastePanel, UploadPanel } from '../local';
import { useActions, useAppState } from '../overmind';
import SourcePanel from '../sourcePanel';
import type { Resource, StorageDialogProps } from '../types';

const HEIGHT = 600;

const Transition = forwardRef((props: SlideProps, ref) => (
  <Slide direction="down" ref={ref} {...props} />
));

const Main: FC<StorageDialogProps> = ({
  config,
  onBackdropClick,
  onCancel,
  onChange,
  onLoad,
  onSave,
  open = false,
  resource: originResource,
  source: originSource,
  type = 'load',
}) => {
  const { cloud } = useAppState();
  const { resource, submit, source } = useAppState().common;
  const { initialize } = useActions().cloud;
  const { clearSubmit, configure, resetAll, setDialogType, setResource } = useActions().common;

  const [isLoading, setIsLoading] = useState(true);

  const theme = useTheme();
  const isMD = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    setDialogType(type);
    init();
  }, []);

  // useEffect(() => {
  //   if (originResource && typeof originResource !== 'string') setResource(originResource);
  // }, [originResource]);

  useEffect(() => {
    if (type === 'save') return;
    if (!onChange) return;

    if (source !== 'cloud') {
      onChange();
      return;
    }

    if (!cloud.owner) return;
    const owner = cloud.name === 'gitlab' ? cloud.owner.id : cloud.owner.username;
    const repo = cloud.name === 'gitlab' ? cloud.repository?.id : cloud.repository?.name;

    const changeObject: Resource = {
      provider: cloud.name,
      ownertype: cloud.owner.type,
      owner,
      repo,
      path: cloud.repositoryContent.path?.join('/'),
      filename: resource?.filename,
    };

    onChange(changeObject);
  }, [cloud.name, cloud.owner, cloud.repository, cloud.repositoryContent.path, resource, source]);

  useEffect(() => {
    if (submit?.action === 'load' && onLoad) onLoad(submit.resource);
    if (submit?.action === 'save' && onSave) onSave(submit.resource);
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

  const clickAway = async () => {
    if (onBackdropClick) {
      await resetAll();
      onBackdropClick();
    }
  };

  return (
    <Dialog
      data-testid="storage-dialog"
      fullScreen={isMD}
      fullWidth
      maxWidth="md"
      onBackdropClick={type === 'load' ? clickAway : undefined}
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
              <Header />
              <DialogContent
                dividers
                sx={{ p: 0, overflowY: source === 'paste' ? 'auto' : 'hidden' }}
              >
                {type === 'save' ? (
                  cloud.providers.length > 0 && <CloudDialog />
                ) : type === 'load' && source === 'paste' ? (
                  <PastePanel />
                ) : type === 'load' && source === 'local' ? (
                  <UploadPanel />
                ) : (
                  type === 'load' && source === 'cloud' && <CloudDialog />
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

export default Main;
