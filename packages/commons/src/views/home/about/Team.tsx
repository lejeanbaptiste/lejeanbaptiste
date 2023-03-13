import { Box, Stack, Typography } from '@mui/material';
import { log } from '@src/utilities';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamProfile, type ProfileProps } from './TeamProfile';

export const Team = () => {
  const { t } = useTranslation();

  const [team, setTeam] = useState<ProfileProps[]>();

  useEffect(() => {
    fetch('./content/team.json')
      .then((res) => res.json())
      .then((res: ProfileProps[]) => setTeam(res))
      .catch((err) => log.error(err));
  }, []);

  return (
    <Box>
      {team && (
        <>
          <Typography component="h3" variant="h5" sx={{ textTransform: 'capitalize' }}>
            {t('home:team')}
          </Typography>
          <Stack mt={4} rowGap={2.5}>
            {team.map((profile) => (
              <TeamProfile key={profile.name} profile={profile} />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
};
