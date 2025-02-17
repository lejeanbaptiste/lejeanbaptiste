import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import Badge, { type BadgeProps } from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import { useLeafWriter } from '@src/hooks';
import { useAppState } from '@src/overmind';
import { motion, type Variants } from 'framer-motion';
import { CloudSyncOutline } from 'mdi-material-ui';
import { useTranslation } from 'react-i18next';

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  '& .MuiBadge-badge': { top: -5, left: 11, minWidth: 4, height: 4 },
}));

export const Cloud = () => {
  const { contentHasChanged: isDirty, isSaving, resource, saveDelayed } = useAppState().editor;

  const { t } = useTranslation();

  const { handleSave } = useLeafWriter();

  const handleClick = () => {
    if (!isDirty || isSaving) return;
    handleSave();
  };

  const animationProps: Variants = {
    visible: { width: 'auto', opacity: 1 },
    hidden: { width: 0, opacity: 0 },
  };

  return (
    <Stack direction="row">
      <Tooltip
        title={
          isDirty
            ? t('LWC.storage.click_to_save')
            : isSaving
              ? t('LWC.storage.saving')
              : t('LWC.storage.all_changes_salved')
        }
      >
        <IconButton
          aria-label="save"
          disableRipple={!isDirty}
          onPointerDown={handleClick}
          size="small"
          sx={[
            {
              mt: -0.125,
              ml: 0.5,
              cursor: 'default',
            },
            isDirty && { cursor: 'pointer' },
          ]}
        >
          {isSaving ? (
            <CloudSyncOutline sx={{ width: 16, height: 16 }} />
          ) : isDirty ? (
            <>
              <StyledBadge color="warning" variant="dot" />
              <CloudQueueIcon color="warning" sx={{ width: 16, height: 16 }} />
            </>
          ) : (
            <CloudDoneOutlinedIcon sx={{ width: 16, height: 16 }} />
          )}
        </IconButton>
      </Tooltip>
      <Box
        position="absolute"
        ml={3.5}
        overflow="hidden"
        sx={{ opacity: 0.5 }}
        component={motion.div}
        variants={animationProps}
        initial="visible"
        animate={saveDelayed ? 'visible' : 'hidden'}
      >
        <Typography ml={0.5} textTransform="capitalize" variant="caption" whiteSpace="nowrap">
          {t('LWC.storage.waiting_for_resource', { provider: resource?.provider })}
        </Typography>
      </Box>
    </Stack>
  );
};
