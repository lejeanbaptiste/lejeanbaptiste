import { Box, ListSubheader } from '@mui/material';
import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import type { AuthorityLookupResult } from '../../types';
import Candidate from './Candidate';

interface CandidateListProps {
  authority: string;
  candidates: AuthorityLookupResult[];
  setAuthorityInView: (view: { id: string; inView: boolean }) => void;
}

const CandidateList = ({ authority, candidates, setAuthorityInView }: CandidateListProps) => {
  const { ref, inView, entry } = useInView({ threshold: 0 });

  useEffect(() => {
    if (entry) setAuthorityInView({ id: entry.target.id, inView });
  }, [inView]);

  return (
    <Box ref={ref} id={authority} sx={{ maxWidth: '90%' }}>
      <ListSubheader
        id={authority}
        sx={{
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: ({ palette }) => palette.grey[500],
          bgcolor: ({ palette }) => {
            return palette.mode === 'dark' ? palette.grey[800] : palette.background.paper;
          },
          lineHeight: 2.5,
          textTransform: 'uppercase',
        }}
      >
        {authority}
      </ListSubheader>
      {candidates.map((candidate) => (
        <Candidate key={candidate.uri} {...candidate} />
      ))}
    </Box>
  );
};

export default CandidateList;
