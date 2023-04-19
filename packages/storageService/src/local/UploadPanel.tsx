import { Stack } from '@mui/material';
import React, { useState } from 'react';
import { UploadDropBox } from '../components';
import { useActions } from '../overmind';
import type { FileDetail } from '../types';

export const UploadPanel = () => {
  const { load } = useActions().common;
  const { setResource } = useActions().local;

  const [fileDetail, setFileDetail] = useState<FileDetail | undefined>();

  const handleSelectFile = async ({ content, file }: FileDetail) => {
    setFileDetail(fileDetail);
    setResource({ content, filename: file.name });
    load();
  };

  return (
    <Stack width="100%" height="100%">
      <UploadDropBox filename={fileDetail?.file.name} onSelectFile={handleSelectFile} />
    </Stack>
  );
};
