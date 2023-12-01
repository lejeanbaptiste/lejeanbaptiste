import { Box, LinearProgress, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getIcon } from '../../../icons';
import { Label } from './Label';

interface UploadPanelZoneProps {
  filename?: string;
  height?: React.CSSProperties['height'];
  isDragAccept?: boolean;
  isDragReject?: boolean;
  isProcessing?: boolean;
  width?: React.CSSProperties['width'];
}

export const Zone = ({
  filename,
  height = 200,
  isDragAccept = false,
  isDragReject = false,
  isProcessing = false,
  width = 'auto',
}: UploadPanelZoneProps) => {
  const { t } = useTranslation('LWStorageService');
  const { palette } = useTheme();

  const IconFileText = useMemo(() => getIcon('fileText'), []);

  const variantsProgress: Variants = {
    show: { height: 'auto' },
    hide: { height: 0 },
  };

  const variantsIcon: Variants = {
    default: { scale: 1, opacity: 0.5 },
    selected: { rotate: 12, opacity: 0.7 },
    processing: { y: -10, x: 10, rotate: 18, transition: { duration: 1 } },
  };

  return (
    <Stack
      component={motion.div}
      layout
      direction="row"
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{
        height,
        width,
        m: 1,
        p: 4,
        overflow: 'hidden',
        borderRadius: 1,
        borderWidth: 1,
        borderStyle: isDragAccept || isDragReject ? 'solid' : 'dashed',
        borderColor: isDragReject
          ? palette.error.light
          : isDragAccept
            ? palette.success.light
            : palette.grey[400],
        bgcolor: palette.mode === 'light' ? palette.grey[50] : palette.grey[800],
        cursor: isProcessing ? 'default' : 'pointer',
      }}
    >
      <IconFileText
        component={motion.svg}
        variants={variantsIcon}
        animate={isProcessing ? 'processing' : !!filename ? 'selected' : 'default'}
        sx={{ height: 40, width: 40 }}
      />
      <Stack>
        <AnimatePresence>
          {!!filename ? (
            <Label key="document" show={!!filename}>
              {filename}
            </Label>
          ) : (
            <Label
              key="info"
              show={!filename}
              sx={{ '::first-letter': { textTransform: 'uppercase' } }}
            >
              {t('local.drag the document here')} {t('commons.or')} {t('local.click to upload')}
            </Label>
          )}
          {isProcessing && (
            <Box
              width="100%"
              height={0}
              overflow="hidden"
              component={motion.div}
              variants={variantsProgress}
              animate={!!isProcessing ? 'show' : 'hide'}
              initial="hide"
              exit="hide"
            >
              <LinearProgress />
            </Box>
          )}
        </AnimatePresence>
      </Stack>
    </Stack>
  );
};
