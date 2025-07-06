import { Box, Link } from '@mui/material';
import { Icon } from '@src/icons';
import type { FileDetail } from '@src/types';
import { UploadDropBox } from '@src/views/storage';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useConversion } from '../hooks';
import { fileDetailAtom, isProcessingAtom } from '../store';

export const View = () => {
  const { t } = useTranslation();
  const { processImportFile: processFile } = useConversion();

  const [fileDetail, setFileDetail] = useAtom(fileDetailAtom);
  const isProcessing = useAtomValue(isProcessingAtom);

  const handleFileSelect = async (fileDetail: FileDetail) => {
    setFileDetail(fileDetail);
    processFile(fileDetail);
  };

  return (
    <Box width="100%">
      <UploadDropBox
        filename={fileDetail?.file.name}
        isProcessing={isProcessing}
        onSelectFile={handleFileSelect}
        width="100%"
      />
      <Link
        href="https://www.leaf-vre.org/docs/documentation/leaf-commons/leaf-te-documentation"
        sx={{ ml: 1 }}
        target="_blank"
        variant="body2"
      >
        {t('LWC.importExport.Learn more about importing files')}
        <Icon name="externalLink" fontSize="inherit" sx={{ mb: -0.75, ml: 1, scale: 1.75 }} />
      </Link>
    </Box>
  );
};
