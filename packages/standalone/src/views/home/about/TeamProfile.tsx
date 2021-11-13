import { Avatar, Box, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import React, { FC } from 'react';

export interface Profile {
  name: string;
  picture?: string;
  positions: string[];
}

interface TeamProfileProps {
  profile: Profile;
}

const TeamProfile: FC<TeamProfileProps> = ({ profile }) => {
  const { name, picture, positions } = profile;

  return (
    <Box
      component={motion.div}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1, originX: 0 }}
    >
      <Stack direction="row" columnGap={1}>
        <Avatar
          component={motion.div}
          whileHover={{ rotate: -30, boxShadow: 'rgba(0,0,0,0.3) 0px 0px 3px 1px' }}
          alt={name}
          src={`/assets/team/${picture}`}
          sx={{ width: 36, height: 36, cursor: 'default' }}
        />
        <Stack>
          <Typography variant="body1" fontWeight={600}>
            {name}
          </Typography>
          {positions.map((position) => (
            <Typography key={position} lineHeight={1.5} variant="caption">
              {position}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

export default TeamProfile;
