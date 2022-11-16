import { Box, Divider, Stack, Typography } from '@mui/material';
import { ProviderButton } from '@src/components';
import { useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_WIDTH = 170;

export const Sidebar: FC = () => {
  const { authProviders } = useAppState().providers;
  const { t } = useTranslation('storage');

  return (
    <AnimatePresence>
      <Stack
        direction="column"
        alignItems="'flex-end"
        overflow="hidden"
        component={motion.div}
        initial={{ x: MAX_WIDTH, width: 0 }}
        animate={{ x: 0, width: MAX_WIDTH }}
        transition={{ type: 'tween', duration: 2 }}
      >
        <Box overflow="hidden" width={MAX_WIDTH} pt={2}>
          <Typography
            pr={2}
            fontWeight={700}
            letterSpacing=".15rem"
            textAlign="center"
            textTransform="uppercase"
            variant="subtitle1"
          >
            {t('commons:sign_in')} {t('commons:with')}
          </Typography>
        </Box>

        <Divider
          sx={{
            width: MAX_WIDTH,
            borderColor: '#999',
            boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)',
          }}
        />
        {
          <Stack gap={2} pt={2} alignItems="center" pr={2}>
            {authProviders.map(({ providerId }) => (
              <ProviderButton key={providerId} name={providerId} />
            ))}
          </Stack>
        }
      </Stack>
    </AnimatePresence>
  );
};
