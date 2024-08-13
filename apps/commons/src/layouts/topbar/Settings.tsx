import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { motion, type Variants } from 'framer-motion';
import { useAtomValue } from 'jotai';

export const Settings = () => {
  const leafWriter = useAtomValue(leafwriterAtom);

  const handleClick = () => {
    leafWriter?.showSettingsDialog();
  };

  const optionVariants: Variants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  return (
    <IconButton
      key="darkMode"
      component={motion.button}
      variants={optionVariants}
      initial="initial"
      animate="visible"
      exit="exit"
      onClick={handleClick}
      size="small"
    >
      <SettingsIcon fontSize="inherit" />
    </IconButton>
  );
};
