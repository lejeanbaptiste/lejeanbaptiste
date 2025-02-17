import { Box, LinearProgress, Stack } from '@mui/material';
import { getIcon } from '@src/icons';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from './label';

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
  const { t } = useTranslation();

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
      sx={[
        {
          height,
          width,
          m: 1,
          p: 4,
          overflow: 'hidden',
          backgroundColor: (theme) => theme.palette.grey[50],
          borderRadius: 1,
          borderWidth: 1,
          borderStyle: isDragAccept || isDragReject ? 'solid' : 'dashed',
        },
        isDragReject
          ? (theme) => ({ borderColor: theme.palette.error.light })
          : isDragAccept
            ? (theme) => ({ borderColor: theme.palette.success.light })
            : (theme) => ({ borderColor: theme.palette.grey[400] }),
        isProcessing ? { cursor: 'default' } : { cursor: 'pointer' },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: theme.palette.grey[800],
          }),
      ]}
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
              {t('SS.local.drag the document here')} {t('SS.commons.or')}{' '}
              {t('SS.local.click to upload')}
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
