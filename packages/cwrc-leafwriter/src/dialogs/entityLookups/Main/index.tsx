import { DialogContent, List, Stack } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { authoritiesAtom, lookupsBeenFetchedAtom } from '../store';
import { CandidatesList } from './candidates-list';
import { ManualEntryField } from './manual-entry-field';
import { SideMenu } from './side-menu';

export const Main = () => {
  const lookupsBeenFetched = useAtomValue(lookupsBeenFetchedAtom);
  const authorities = useAtomValue(authoritiesAtom);

  const [authorityInView, setAuthorityInView] = useState<string[]>([]);

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
      <DialogContent sx={{ height: '65vh', px: 1, pt: 0, pb: 0.5 }}>
        <List
          sx={{
            pb: 0,
            filter: lookupsBeenFetched === authorities.length ? 'blur(4px)' : 'none',
            '& ul': { p: 0 },
          }}
          subheader={<li />}
        >
          {authorities.map((authority) => (
            <CandidatesList
              key={authority.id}
              authority={authority}
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
