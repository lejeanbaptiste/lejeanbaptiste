import type { ElementDetail } from '@cwrc/leafwriter-validator';
import { Box, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  count?: number;
  tagMeta?: ElementDetail;
  tagName?: string;
  xpath?: string;
}

export const Header = ({ count, tagMeta, tagName, xpath }: HeaderProps) => {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState<string | undefined>();

  useEffect(() => {
    if (!tagMeta?.fullName) return;
    setFullName(tagMeta.fullName);
  }, [tagMeta]);

  return (
    <Tooltip enterDelay={2500} placement="top" title={count > 1 ? undefined : xpath}>
      <Box
        display="flex"
        justifyContent="center"
        mt={-0.5}
        mb={0.5}
        sx={{ cursor: 'default', bgcolor: ({ palette }) => palette.action.selected }}
      >
        {count ? (
          <Typography sx={{ textTransform: 'capitalize' }} variant="caption">
            {`${t('multiple tags')} (${count})`}
          </Typography>
        ) : (
          <Typography variant="caption">
            {`<${tagName}>`}
            {fullName && (
              <Typography component="span" sx={{ textTransform: 'capitalize' }} variant="caption">
                {` ${fullName}`}
              </Typography>
            )}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};
