import { Box, MenuList } from '@mui/material';
import type { SearchResults, Content, SearchResultsBlobs } from '@src/@types/types';
import { motion } from 'framer-motion';
import React, { FC } from 'react';
import Results from './Results';

interface ResultsCollectionProps {
  listBoxProps?: any;
  options: SearchResults[];
  onPrimaryAction: (item: Content | SearchResultsBlobs) => void;
  onSecondaryAction: (item: Content | SearchResultsBlobs) => void;
}

const ResultsCollection: FC<ResultsCollectionProps> = ({
  listBoxProps,
  options,
  onPrimaryAction,
  onSecondaryAction,
}) => {
  const variants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  return (
    <Box
      data-testid="search-global-result-collection"
      component={motion.div}
      variants={variants}
      initial="initial"
      animate="visible"
      exit="exit"
      role="listbox"
      maxHeight={420}
      mt={options.length > 0 ? 1 : 0}
      sx={{ overflow: 'auto' }}
    >
      <MenuList {...listBoxProps} sx={{ py: 0 }}>
        {options.map(({ searchType, results }, index) => (
          <Box key={index} pt={index === 0 ? 0 : 2}>
            <Results
              type={searchType}
              list={results}
              onPrimaryAction={onPrimaryAction}
              onSecondaryAction={onSecondaryAction}
            />
          </Box>
        ))}
      </MenuList>
    </Box>
  );
};

export default ResultsCollection;
