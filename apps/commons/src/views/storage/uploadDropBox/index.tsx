import { Box } from '@mui/material';
import { useActions } from '@src/overmind';
import type { FileDetail } from '@src/types';
import { createRef, useMemo } from 'react';
import Dropzone, { type DropzoneRef } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Zone } from './components';

export type AllowedMimeType =
  | 'application/json'
  | 'application/pdf'
  | 'application/xml'
  | 'text/csv'
  | 'text/html'
  | 'text/plain'
  | 'text/xml';

interface UploadDropBoxProps {
  allowedMimeTypes?: AllowedMimeType[];
  filename?: string;
  height?: number;
  isProcessing?: boolean;
  onSelectFile: (fileDetail: FileDetail) => Promise<void>;
  width?: React.CSSProperties['width'];
}

export const UploadDropBox = ({
  allowedMimeTypes = ['application/xml', 'text/xml'],
  filename,
  height = 200,
  isProcessing = false,
  onSelectFile,
  width = 'auto',
}: UploadDropBoxProps) => {
  const { t } = useTranslation();

  const { uploadFile } = useActions().storage;
  const { notifyViaSnackbar } = useActions().ui;

  const dropzoneRef = createRef<DropzoneRef>();

  const acceptedMimeTypes = useMemo(() => {
    if (!allowedMimeTypes) return {};

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
      notifyViaSnackbar({
        message: `${t('LWC.messages.unable_to_upload file', { filename: selectedFile.name })}`,
        options: { variant: 'error' },
      });

      return;
    }

    onSelectFile({ file: selectedFile, content });
  };

  return (
    <Dropzone
      accept={acceptedMimeTypes}
      disabled={isProcessing}
      maxFiles={1}
      multiple={false}
      noDragEventsBubbling={true}
      onDrop={HandleDrop}
      ref={dropzoneRef}
    >
      {({ getRootProps, getInputProps, isDragAccept, isDragReject }) => (
        <Box {...getRootProps()} alignItems="center">
          <input {...getInputProps()} data-testid="upload_panel-input" />
          <Zone {...{ filename, height, isDragAccept, isDragReject, isProcessing, width }} />
        </Box>
      )}
    </Dropzone>
  );
};
