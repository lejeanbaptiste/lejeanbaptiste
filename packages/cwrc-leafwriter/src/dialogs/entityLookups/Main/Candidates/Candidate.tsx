import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { IconButton, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useState } from 'react';
import { useActions, useAppState } from '../../../../overmind';
import type { AuthorityLookupResult, EntryLink } from '../../../../types/authority';

const Candidate = ({ authority, description, entityType, label, uri }: AuthorityLookupResult) => {
  const { closeEntityLookupsDialog } = useActions().ui;
  const { selected } = useAppState().lookups;
  const { setSelected, processSelected } = useActions().lookups;

  const [hover, setHover] = useState(false);

  const handleOnClick = () => {
    const entry: EntryLink = { authority, entityType, label, uri };
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
      sx={{ my: 0.5 }}
      onClick={handleOnClick}
      onDoubleClick={handleOnDoubleClick}
    >
      <ListItemButton selected={selected?.uri === uri} sx={{ borderRadius: 1 }}>
        <ListItemText
          primary={label}
          secondary={
            description && (
              <Typography
                color="text.secondary"
                // fontSize="0.775rem"
                sx={{
                  display: selected?.uri === uri ? 'block' : '-webkit-box',
                  // * WebkitBoxOrient is deprecated, but still works. See: https://developer.mozilla.org/en-US/docs/Web/CSS/box-orient
                  // TODO: Replace WebkitBoxOrient for another solution.
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: '2',
                  overflow: selected?.uri === uri ? 'auto' : 'hidden',
                  transition: '0.4s',
                }}
                variant="body2"
              >
                {description}
              </Typography>
            )
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Candidate;
