import { Box } from '@mui/material';
import { Profile } from '@src/components';
import React, { FC, useRef, useState } from 'react';

interface ProfileAnchorProps {
  children?: React.ReactNode;
}

export const ProfileAnchor: FC<ProfileAnchorProps> = ({ children }) => {
  const [anchorProfileEl, setAnchorProfileEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef(null);

  const handleProfileClick = () => setAnchorProfileEl(ref.current);
  const handleProfileClose = () => setAnchorProfileEl(null);

  return (
    <Box id="test" ref={ref} onClick={handleProfileClick}>
      {children}
      {anchorProfileEl && <Profile anchor={anchorProfileEl} onClose={handleProfileClose} />}
    </Box>
  );
};
