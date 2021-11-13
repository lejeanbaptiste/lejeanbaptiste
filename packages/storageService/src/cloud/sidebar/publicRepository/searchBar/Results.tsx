import { Box, MenuList } from '@mui/material';
import type { Owner } from '@src/@types/types';
import { motion } from 'framer-motion';
import React, { FC } from 'react';
import Item from './Item';

interface ResultsProps {
  listBoxProps: any;
  options: Owner[];
  onSelect?: (onwer: Owner) => void;
}

const Results: FC<ResultsProps> = ({ listBoxProps, options, onSelect }) => {
  const variants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  const handleSelectOption = (onwer: Owner) => onSelect && onSelect(onwer);

  return (
    <Box
      component={motion.div}
      variants={variants}
      initial="initial"
      animate="visible"
      exit="exit"
      sx={{ maxHeight: 300, overflow: 'auto' }}
    >
      <MenuList {...listBoxProps} sx={{ py: 0 }}>
        {options.map((option, index) => (
          <Item key={index} item={option} onSelect={handleSelectOption} />
        ))}
      </MenuList>
    </Box>
  );
};

export default Results;
