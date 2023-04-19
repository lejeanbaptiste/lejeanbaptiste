import { Stack } from '@mui/material';
import type { FileDetail } from '@src/types';
import { UploadDropBox } from '@src/views/storage';
import { useAtom, useAtomValue } from 'jotai';
import React from 'react';
import { useConversion } from '../hooks';
import { fileDetailAtom, isProcessingAtom } from '../store';

export const View = () => {
  const { processImportFile: processFile } = useConversion();

  const [fileDetail, setFileDetail] = useAtom(fileDetailAtom);
  const isProcessing = useAtomValue(isProcessingAtom);

  const handleFileSelect = async (fileDetail: FileDetail) => {
    setFileDetail(fileDetail);
    processFile(fileDetail);
  };

  return (
    <Stack width="100%">
      <UploadDropBox
        filename={fileDetail?.file.name}
        isProcessing={isProcessing}
        width="100%"
        onSelectFile={handleFileSelect}
      />
    </Stack>
  );
};
