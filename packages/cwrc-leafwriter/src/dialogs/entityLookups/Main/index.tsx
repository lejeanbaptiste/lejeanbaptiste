import { DialogContent, List, Stack } from '@mui/material';
import { useState } from 'react';
import { useAppState } from '../../../overmind';
import CandidateList from './Candidates';
import ManualEntryField from './Candidates/ManualEntryField';
import SideMenu from './SideMenu';

const Main = () => {
  const [authorityInView, setAuthorityInView] = useState<string[]>([]);
  const { results } = useAppState().lookups;

  const handleSetAuthorityInView = (view: { id: string; inView: boolean }) => {
    let InView: string[] = [];
    if (view.inView && !authorityInView.includes(view.id)) {
      InView = [...authorityInView, view.id];
    }

    if (!view.inView && authorityInView.includes(view.id)) {
      InView = authorityInView.filter((id) => id !== view.id);
    }

    setAuthorityInView(InView);
  };

  return (
    <Stack direction="row">
      <DialogContent sx={{ px: 1, pt: 0, pb: 0.5, maxHeight: '65vh' }}>
        <List sx={{ '& ul': { padding: 0 } }} subheader={<li />}>
          {results &&
            [...results].map(([authority, candidates]) => (
              <CandidateList
                key={authority}
                authority={authority}
                candidates={candidates}
                setAuthorityInView={handleSetAuthorityInView}
              />
            ))}
        </List>
        <ManualEntryField setAuthorityInView={handleSetAuthorityInView} />
      </DialogContent>
      <SideMenu authorityInView={authorityInView} />
    </Stack>
  );
};

export default Main;
