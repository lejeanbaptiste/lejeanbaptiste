import ScreenRotationOutlinedIcon from '@mui/icons-material/ScreenRotationOutlined';
import ScreenshotMonitorOutlinedIcon from '@mui/icons-material/ScreenshotMonitorOutlined';
import { Stack, Typography } from '@mui/material';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const SmallScreenMessage: FC = () => {
  const { t } = useTranslation('messages');
  return (
    <Stack alignItems="center" gap={2} mt={1}>
      <Stack direction="row" gap={2}>
        <ScreenRotationOutlinedIcon sx={{ width: 30, height: 30, opacity: 0.7 }} />
        <ScreenshotMonitorOutlinedIcon sx={{ width: 30, height: 30, opacity: 0.7 }} />
      </Stack>
      <Typography letterSpacing=".05rem" textAlign="center" variant="body2">
        {`${t('annotation_need_space')} ${t('rotate_phone')}`}
      </Typography>
    </Stack>
  );
};
