import { Box, Stack, Typography } from '@mui/material';
import { log } from '@src/utilities';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeamProfile, { Profile } from './TeamProfile';

const Team: FC = () => {
  const { t } = useTranslation();

  const [team, setTeam] = useState<Profile[]>();

  useEffect(() => {
    fetch('./content/team.json')
      .then((res) => res.json())
      .then((res: Profile[]) => setTeam(res))
      .catch((err) => log.error(err));
  }, []);

  return (
    <Box>
      {team && (
        <>
          <Typography component="h3" variant="h5">
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

export default Team;
