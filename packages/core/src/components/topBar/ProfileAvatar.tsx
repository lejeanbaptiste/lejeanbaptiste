import { Avatar, Badge, Box, Icon, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import { motion } from 'framer-motion';
import React, { FC, useRef, useState } from 'react';
import Profile from '../Profile';
import { getIcon } from '@src/utilities/icons';

const ProfileAvatar: FC = () => {
  const theme = useTheme();
  const { user } = useAppState();

  const ref = useRef(null);
  const [anchorProfileEl, setAnchorProfileEl] = useState<HTMLDivElement | null>(null);

  const handleProfileClick = () => setAnchorProfileEl(ref.current);
  const handleProfileClose = () => setAnchorProfileEl(null);

  const profileVariants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  //? SHOULD STACK BADGE AND AVATAR: CHECK BADGE DOCUMENTATION.
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
          user?.prefferedID && (
            <Icon
              component={getIcon(user?.prefferedID)}
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `1px solid ${theme.palette.background.paper}`,
                backgroundColor: theme.palette.background.paper,
                // cursor: 'pointer',
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
