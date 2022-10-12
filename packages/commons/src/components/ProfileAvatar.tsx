import { Avatar, Badge, Box, Icon, useTheme } from '@mui/material';
import { useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities';
import { motion } from 'framer-motion';
import React, { useState, type FC } from 'react';

interface ProfileAvatarProps {
  clickable?: boolean;
  size?: number;
}

export const ProfileAvatar: FC<ProfileAvatarProps> = ({ clickable = true, size = 32 }) => {
  const { user } = useAppState().auth;
  const { palette } = useTheme();

  const [hover, setHover] = useState(false);

  const handleMouseOver = () => setHover(true);
  const handleMouseOut = () => setHover(false);

  const profileVariants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  const avatarVariant = {
    default: { boxShadow: `${palette.primary.main} 0px 0px 0px 0px` },
    hover: { boxShadow: `${palette.primary.main} 0px 0px 3px 1px` },
  };

  const badgeVariant = {
    default: { marginTop: 0, marginLeft: 0 },
    hover: { marginTop: 8, marginLeft: 8 },
  };

  return (
    <Box
      component={motion.div}
      variants={profileVariants}
      initial="initial"
      animate="visible"
      exit="exit"
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      <Badge
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          user?.preferredID && (
            <Box
              component={motion.div}
              borderRadius="50%"
              width={size / 2}
              height={size / 2}
              variants={badgeVariant}
              animate={hover && clickable ? 'hover' : 'default'}
              sx={{ cursor: clickable ? 'pointer' : 'default' }}
            >
              <Icon
                component={getIcon(user?.preferredID)}
                sx={{
                  width: size / 2,
                  height: size / 2,
                  borderRadius: '50%',
                  border: `1px solid ${palette.background.paper}`,
                  backgroundColor: palette.background.paper,
                }}
              />
            </Box>
          )
        }
        overlap="circular"
      >
        <Avatar
          component={motion.div}
          animate={hover && clickable ? 'hover' : 'default'}
          variants={avatarVariant}
          src={user?.avatar_url}
          sx={{ width: size, height: size, cursor: clickable ? 'pointer' : 'default' }}
        />
      </Badge>
    </Box>
  );
};
