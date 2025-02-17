import { Avatar, Box, Stack, Typography } from '@mui/material';
import md5 from 'md5';
import { motion } from 'motion/react';

export interface ProfileProps {
  name: string;
  email?: string;
  positions: string[];
}

interface TeamProfileProps {
  profile: ProfileProps;
}

export const TeamProfile = ({ profile }: TeamProfileProps) => {
  const { name, email, positions } = profile;

  const gravatarUrl = email ? `https://www.gravatar.com/avatar/${md5(email)}?s=64` : undefined;

  return (
    <Box component={motion.div} initial={{ scale: 0 }} animate={{ scale: 1 }}>
      <Stack direction="row" columnGap={1}>
        <Avatar
          component={motion.div}
          whileHover={{ rotate: -30, boxShadow: 'rgba(0,0,0,0.3) 0px 0px 3px 1px' }}
          alt={name}
          src={gravatarUrl}
          sx={{ width: 36, height: 36, color: 'text.primary', cursor: 'default' }}
        >
          {!gravatarUrl && name.slice(0, 1)}
        </Avatar>
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
