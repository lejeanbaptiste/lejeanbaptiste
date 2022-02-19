import { Box, ListSubheader } from '@mui/material';
import React, { FC, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Authority, IResult } from '../../types';
import Candidate from './Candidate';

interface CandidateListProps {
  authority: Authority;
  candidates: IResult[];
  setAuthorityInView: (view: { id: string; inView: boolean }) => void;
}

const CandidateList: FC<CandidateListProps> = ({ authority, candidates, setAuthorityInView }) => {
  const { ref, inView, entry } = useInView({
    /* Optional options */
    threshold: 0,
  });

  useEffect(() => {
    if (entry) setAuthorityInView({ id: entry.target.id, inView });
  }, [inView]);

  return (
    <Box ref={ref} id={authority} sx={{ maxWidth: '90%' }}>
      <ListSubheader
        id={authority}
        className="authority-lookup-list"
        sx={{
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: ({ palette }) => palette.grey[500],
          backgroundColor: ({ palette }) => {
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
