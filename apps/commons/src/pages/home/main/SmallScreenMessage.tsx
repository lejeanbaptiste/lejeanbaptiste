import ScreenRotationOutlinedIcon from '@mui/icons-material/ScreenRotationOutlined';
import ScreenshotMonitorOutlinedIcon from '@mui/icons-material/ScreenshotMonitorOutlined';
import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const SmallScreenMessage = () => {
  const { t } = useTranslation();
  return (
    <Stack alignItems="center" gap={2} mt={1}>
      <Stack direction="row" gap={2}>
        <ScreenRotationOutlinedIcon sx={{ width: 30, height: 30, opacity: 0.7 }} />
        <ScreenshotMonitorOutlinedIcon sx={{ width: 30, height: 30, opacity: 0.7 }} />
      </Stack>
      <Typography letterSpacing=".05rem" textAlign="center" variant="body2">
        {`${t('LWC.messages.annotation_need_space')} ${t('LWC.messages.rotate_phone')}`}
      </Typography>
    </Stack>
  );
};
