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
import React, { forwardRef, useEffect, useState } from 'react';
import { CloudDialog } from '../cloud';
import { FooterLoad, FooterSave } from '../footer';
import { Header } from '../header';
import { useDialog } from '../hooks/useDialog';
import { PastePanel, UploadPanel } from '../local';
import { useActions, useAppState } from '../overmind';
import { SourcePanel } from '../sourcePanel';
import type { Resource, StorageDialogProps } from '../types';

const HEIGHT = 600;

const Transition = forwardRef((props: SlideProps, ref) => (
  <Slide direction="down" ref={ref} {...props} />
));

export const Main = ({
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
