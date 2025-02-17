import { Box, ListSubheader } from '@mui/material';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { LookupService } from '../../store';
import { Item } from './item';

interface CandidateListProps {
  authority: LookupService;
  setAuthorityInView: (view: { id: string; inView: boolean }) => void;
}

export const CandidatesList = ({ authority, setAuthorityInView }: CandidateListProps) => {
  const { entry, inView, ref } = useInView({ threshold: 0 });

  useEffect(() => {
    if (entry) setAuthorityInView({ id: entry.target.id, inView });
  }, [inView]);

  return (
    <Box ref={ref} id={authority.id}>
      <ListSubheader
        id={authority.id}
        sx={[
          {
            backgroundColor: (theme) => theme.vars.palette.background.paper,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'grey.500',
            lineHeight: 2.5,
            textTransform: 'uppercase',
          },
          (theme) =>
            theme.applyStyles('dark', {
              backgroundColor: theme.vars.palette.grey[800],
            }),
        ]}
      >
        {authority.name}
      </ListSubheader>
      {authority.results?.status === 'success' &&
        authority.results?.candidates.map((candidate) => (
          <Item key={candidate.uri} authority={authority.id} {...candidate} />
        ))}
    </Box>
  );
};
