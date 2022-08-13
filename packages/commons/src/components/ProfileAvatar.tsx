import { Avatar, Badge, Box, Icon, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities/icons';
import { motion } from 'framer-motion';
import React, { FC, useRef, useState } from 'react';
import Profile from './Profile';

const ProfileAvatar: FC = () => {
  const { user } = useAppState().auth;
  const theme = useTheme();

  const ref = useRef(null);
  const [anchorProfileEl, setAnchorProfileEl] = useState<HTMLDivElement | null>(null);

  const handleProfileClick = () => setAnchorProfileEl(ref.current);
  const handleProfileClose = () => setAnchorProfileEl(null);

  const profileVariants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  return (
    <Box
      ref={ref}
      key="profile"
      component={motion.div}
      variants={profileVariants}
      initial="initial"
      animate="visible"
      exit="exit"
    >
      <Badge
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          user?.preferredID && (
            <Icon
              component={getIcon(user?.preferredID)}
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `1px solid ${theme.palette.background.paper}`,
                backgroundColor: theme.palette.background.paper,
              }}
            />
          )
        }
        overlap="circular"
      >
        <Avatar
          component={motion.div}
          whileHover={{ boxShadow: `${theme.palette.primary.main} 0px 0px 3px 1px` }}
          onClick={handleProfileClick}
          src={user?.avatar_url}
          sx={{ width: 32, height: 32, cursor: 'pointer' }}
        />
      </Badge>
      {anchorProfileEl && <Profile anchor={anchorProfileEl} handleClose={handleProfileClose} />}
    </Box>
  );
};

export default ProfileAvatar;
