import { Box } from '@mui/material';
import { Profile } from '@src/views';
import { useRef, useState } from 'react';

interface ProfileAnchorProps {
  children?: React.ReactNode;
}

export const ProfileAnchor = ({ children }: ProfileAnchorProps) => {
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
