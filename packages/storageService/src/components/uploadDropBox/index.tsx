import { Stack } from '@mui/material';
import { createRef, useMemo } from 'react';
import Dropzone, { type DropzoneRef } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import type { AllowedMimeType, FileDetail } from '../../types';
import { Zone } from './components';

interface UploadDropBoxProps {
  allowedMimeTypes?: AllowedMimeType[];
  filename?: string;
  height?: number;
  isProcessing?: boolean;
  onSelectFile: (fileDetail: FileDetail) => Promise<void>;
  width?: React.CSSProperties['width'];
}

export const UploadDropBox = ({ filename, onSelectFile }: UploadDropBoxProps) => {
  const { allowedMimeTypes } = useAppState().common;

  const { uploadFile } = useActions().local;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('LWStorageService');

  const dropzoneRef = createRef<DropzoneRef>();

  const acceptedMimeTypes = useMemo(() => {
    if (!allowedMimeTypes) return;
    const mimeTypes: Record<string, string[]> = {};
    allowedMimeTypes?.forEach((mimeType) => {
      const [, ext] = mimeType.split('/');
      if (!mimeTypes[mimeType]) mimeTypes[mimeType] = [];
      if (!mimeTypes[mimeType].includes(ext)) mimeTypes[mimeType].push(`.${ext}`);
    });

    return mimeTypes;
  }, []);

  const HandleDrop = async (acceptedFiles: File[]) => {
    const accepted = acceptedFiles.length > 0;
    if (!accepted) return;

    const selectedFile = acceptedFiles[0];

    const content = await uploadFile(selectedFile);

    if (!content) {
      openDialog({
        props: {
          maxWidth: 'xs',
          preventEscape: true,
          severity: 'error',
          title: `${t('local.message.unable_to_upload_file', { filename: selectedFile.name })}`,
        },
      });

      return;
    }

    onSelectFile({ file: selectedFile, content });
  };

  return (
    <Stack height="100%" justifyContent="center">
      <Dropzone
        accept={acceptedMimeTypes}
        maxFiles={1}
        multiple={false}
        noDragEventsBubbling={true}
        onDrop={HandleDrop}
        ref={dropzoneRef}
      >
        {({ getRootProps, getInputProps, isDragAccept, isDragReject }) => (
          <Stack {...getRootProps()} alignItems="center">
            <input {...getInputProps()} data-testid="upload_panel-input" />
            <Zone {...{ filename, isDragAccept, isDragReject }} />
          </Stack>
        )}
      </Dropzone>
    </Stack>
  );
};
