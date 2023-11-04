import { Box, MenuList } from '@mui/material';
import { motion, type Variants } from 'framer-motion';
import type { PublicRepository } from '../../../../../../types';
import { Item } from './Item';

interface ResultsProps {
  listBoxProps: any;
  onSelect?: (publicRepository: PublicRepository) => void;
  options: PublicRepository[];
}

export const Results = ({ listBoxProps, onSelect, options }: ResultsProps) => {
  const variants: Variants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  const handleSelectOption = (publicRepository: PublicRepository) => {
    onSelect && onSelect(publicRepository);
  };

  return (
    <Box
      data-testid="search-user-result"
      component={motion.div}
      variants={variants}
      initial="initial"
      animate="visible"
      exit="exit"
      sx={{ maxHeight: 300, overflow: 'auto' }}
    >
      <MenuList {...listBoxProps} sx={{ py: 0 }}>
        {options.map((option, index) => (
          <Item key={index} publicRepository={option} onSelect={handleSelectOption} />
        ))}
      </MenuList>
    </Box>
  );
};
