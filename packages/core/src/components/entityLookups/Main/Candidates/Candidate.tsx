import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { IconButton, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import React, { FC, useState } from 'react';
import { EntryLink, IResult } from '../../types';

const Candidate: FC<IResult> = ({ description, id, name, repository, uri }) => {
  const { closeEntityLookupsDialog } = useActions().ui;
  const { selected } = useAppState().lookups;
  const { setSelected, processSelected } = useActions().lookups;

  const [hover, setHover] = useState(false);

  const handleOnClick = () => {
    const entry: EntryLink = { id, uri, name, repository };
    setSelected(entry);
  };

  const handleOnDoubleClick = () => {
    if (uri !== selected?.uri) return;

    const link = processSelected();
    if (!link) return;

    closeEntityLookupsDialog(link);
  };

  return (
    <ListItem
      dense
      disablePadding
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      secondaryAction={
        <IconButton aria-label="open-uri" edge="end" size="small" target="_blank" href={uri}>
          {hover && <OpenInNewIcon fontSize="inherit" />}
        </IconButton>
      }
      selected={selected?.uri === uri}
      sx={{ my: 0.5 }}
      onClick={handleOnClick}
      onDoubleClick={handleOnDoubleClick}
    >
      <ListItemButton sx={{ borderRadius: 1 }}>
        <ListItemText
          primary={name}
          secondary={description && <span dangerouslySetInnerHTML={{ __html: description }} />}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Candidate;
