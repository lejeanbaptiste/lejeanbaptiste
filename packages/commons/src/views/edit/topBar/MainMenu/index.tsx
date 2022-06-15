import MenuIcon from '@mui/icons-material/Menu';
import { Box, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import React, { FC, useRef, useState } from 'react';
import Menu from './Menu';

const MainMenu: FC = () => {
  const ref = useRef(null);
  const [anchorProfileEl, setAnchorProfileEl] = useState<HTMLDivElement | null>(null);

  const handleClick = () => setAnchorProfileEl(ref.current);
  const handleClose = () => setAnchorProfileEl(null);

  const profileVariants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  return (
    <Box
      ref={ref}
      component={motion.div}
      variants={profileVariants}
      initial="initial"
      animate="visible"
      exit="exit"
      sx={{ mr: 1 }}
    >
      <IconButton aria-label="Main Menu" onClick={handleClick} size="medium" sx={{ mr: 2 }}>
        <MenuIcon fontSize="inherit" />
      </IconButton>
      {anchorProfileEl && <Menu anchor={anchorProfileEl} onClose={handleClose} />}
    </Box>
  );
};

export default MainMenu;
