import { Avatar, Badge, Box, Icon, useTheme } from '@mui/material';
import { getIcon, type IconName } from '@src/icons';
import { useAppState } from '@src/overmind';
import { motion, useAnimation, type Variants } from 'motion/react';
import { useEffect, useState } from 'react';

interface ProfileAvatarProps {
  clickable?: boolean;
  size?: number;
}

export const ProfileAvatar = ({ clickable = true, size = 32 }: ProfileAvatarProps) => {
  const { user } = useAppState().auth;
  const theme = useTheme();

  const badgeAnimationControl = useAnimation();

  const [hover, setHover] = useState(false);
  const [id, setId] = useState(user?.preferredID);

  const handleMouseOver = () => {
    badgeAnimationControl.start({ marginTop: 8, marginLeft: 8 });
    setHover(true);
  };
  const handleMouseOut = () => {
    badgeAnimationControl.start({ marginTop: 0, marginLeft: 0 });
    setHover(false);
  };

  useEffect(() => {
    if (clickable && user?.preferredID !== id) {
      badgeAnimationControl.start({
        scale: 3,
        rotate: 90,
        transition: { duration: 0.7, repeat: 1, repeatType: 'mirror' },
      });
      setId(user?.preferredID);
    }
  }, [user?.preferredID]);

  const profileVariants: Variants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  const avatarVariant: Variants = {
    default: { boxShadow: `${theme.vars.palette.primary.main} 0px 0px 0px 0px` },
    hover: { boxShadow: `${theme.vars.palette.primary.main} 0px 0px 3px 1px` },
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
              animate={badgeAnimationControl}
              sx={[{ cursor: 'default' }, clickable && { cursor: 'pointer' }]}
            >
              <Icon
                component={getIcon(user.preferredID as IconName)}
                sx={[
                  (theme) => ({
                    width: size / 2,
                    height: size / 2,
                    backgroundColor: theme.vars.palette.background.paper,
                    borderRadius: '50%',
                    border: `1px solid ${theme.vars.palette.background.paper}`,
                    cursor: 'default',
                  }),
                  clickable && { cursor: 'pointer' },
                ]}
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
          sx={[
            {
              width: size,
              height: size,
              cursor: 'default',
            },
            clickable && { cursor: 'pointer' },
          ]}
        />
      </Badge>
    </Box>
  );
};
