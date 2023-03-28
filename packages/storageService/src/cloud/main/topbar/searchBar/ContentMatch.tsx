import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import parse from 'autosuggest-highlight/parse';
import { motion, type Variants } from 'framer-motion';
import React from 'react';

export interface ResultItem {
  excerpt?: string;
  name: string;
  ownerId: string;
  ownerName: string;
  path: string;
  pathToFile: string[];
  repositoryId: string;
  repositoryName: string;
  text_matches?: any[];
  type: 'folder' | 'file';
}

interface ContentMatchProps {
  text_matches: any[];
}

const ContentMatch = ({ text_matches }: ContentMatchProps) => {
  const variants: Variants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  return (
    <Stack
      data-testid="search-match-details"
      component={motion.div}
      variants={variants}
      initial="initial"
      animate="visible"
      exit="exit"
      mt={0.5}
      sx={{
        py: 0.25,
        px: 1,
        borderRadius: 1,
        backgroundColor: ({ palette }) => alpha(palette.grey[300], 0.2),
      }}
    >
      {text_matches?.map(({ fragment, matches }, index) => {
        let parts = parse(
          fragment,
          matches.map((match: any) => match.indices)
        );

        parts = [{ text: '... ', highlight: false }, ...parts, { text: ' ...', highlight: false }];

        return (
          <Box key={index}>
            {parts.map((part, partIndex) => (
              <Typography
                key={partIndex}
                component="span"
                color={part.highlight ? 'text.primary' : 'text.secondary'}
                sx={{
                  fontWeight: part.highlight ? 700 : 400,
                  overflowWrap: 'break-word',
                }}
                variant="caption"
              >
                {part.text}
              </Typography>
            ))}
          </Box>
        );
      })}
    </Stack>
  );
};

export default ContentMatch;
