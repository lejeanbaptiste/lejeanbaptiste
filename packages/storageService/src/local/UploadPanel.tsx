import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import React, { createRef, FC, useEffect, useRef, useState } from 'react';
import Dropzone, { DropzoneRef } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

export const UploadPanel: FC = () => {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { allowedMimeTypes } = useAppState().common;
  const { setResource, uploadFile } = useActions().local;
  const { load, showAlertDialog } = useActions().common;
  const dropzoneRef = createRef<DropzoneRef>();

  const container = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(150);

  useEffect(() => {
    setTimeout(() => dropzoneRef.current?.open(), 50);

    if (container.current) {
      handleWindowResize();
      window.addEventListener('resize', handleWindowResize);
    }
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const handleWindowResize = () => {
    setContainerHeight(container.current?.getBoundingClientRect().height ?? 150);
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const accepted = acceptedFiles.length > 0;
    if (accepted) handleSelectFile(acceptedFiles[0]);
  };

  const handleSelectFile = async (file: File) => {
    const document = await uploadFile(file);
    if (!document) {
      showAlertDialog({
        type: 'error',
        message: t('error:message:unable_to_upload_file', { filename: file.name }),
      });
      return;
    }

    setResource({ content: document, filename: file.name });
    load();
  };

  const mimeTypeTransformation = () => {
    if (!allowedMimeTypes) return;
    const mimeTypes: { [key: string]: string[] } = {};
    allowedMimeTypes?.forEach((mimeType) => {
      const [, ext] = mimeType.split('/');
      if (!mimeTypes[mimeType]) mimeTypes[mimeType] = [];
      if (!mimeTypes[mimeType].includes(ext)) mimeTypes[mimeType].push(`.${ext}`);
    });

    return mimeTypes;
  };

  return (
    <Box ref={container} height="97%">
      <Dropzone
        accept={mimeTypeTransformation()}
        maxFiles={1}
        multiple={false}
        noDragEventsBubbling={true}
        onDrop={onDrop}
        ref={dropzoneRef}
      >
        {({ getRootProps, getInputProps, isDragAccept, isDragReject }) => (
          <Box {...getRootProps()}>
            <input {...getInputProps()} data-testid="upload_panel-input" />
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={2}
              sx={{
                cursor: 'pointer',
                overflow: 'hidden',
                height: containerHeight,
                m: 1,
                borderRadius: 1,
                borderWidth: 1,
                borderStyle: isDragAccept || isDragReject ? 'solid' : 'dashed',
                borderColor: isDragReject
                  ? palette.error.light
                  : isDragAccept
                  ? palette.success.light
                  : palette.grey[400],
                color: palette.grey[400],
                backgroundColor: palette.mode === 'light' ? palette.grey[50] : palette.grey[800],
              }}
            >
              <Typography>{t('local:drag_drop')}</Typography>
              <UploadFileIcon sx={{ height: '50%', width: '50%' }} />
            </Stack>
          </Box>
        )}
      </Dropzone>
    </Box>
  );
};
