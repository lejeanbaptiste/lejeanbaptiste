import { IconButton, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';
import { RxExternalLink } from 'react-icons/rx';
import type { Authority, AuthorityLookupResult } from '../../../../types/authority';
import { lookupTypeAtom, onCloseAtom, selectedAtom } from '../../store';
import { useEntityLookup } from '../../useEntityLookup';

interface Props extends AuthorityLookupResult {
  authority: Authority | (string & {});
}

export const Item = ({ authority, description, label, uri }: Props) => {
  const lookupType = useAtomValue(lookupTypeAtom);
  const onClose = useAtomValue(onCloseAtom);
  const [selected, setSelected] = useAtom(selectedAtom);

  const { processSelected } = useEntityLookup();
  const [hover, setHover] = useState(false);

  const handleOnDoubleClick = () => {
    if (uri !== selected?.uri) return;

    const link = processSelected();
    if (!link) return;

    onClose?.(link);
  };

  return (
    <ListItem
      dense
      disablePadding
      onClick={() => setSelected({ authority, entityType: lookupType, label, uri })}
      onDoubleClick={handleOnDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      secondaryAction={
        <IconButton aria-label="open-uri" edge="end" href={uri} size="small" target="_blank">
          {hover && <RxExternalLink fontSize="inherit" />}
        </IconButton>
      }
      sx={{ my: 0.5 }}
    >
      <ListItemButton selected={selected?.uri === uri} sx={{ borderRadius: 1 }}>
        <ListItemText
          primary={label}
          secondary={
            description && (
              <Typography
                color="text.secondary"
                sx={{
                  display: selected?.uri === uri ? 'block' : '-webkit-box',
                  overflow: selected?.uri === uri ? 'auto' : 'hidden',
                  transition: '0.4s',
                  WebkitBoxOrient: 'vertical', // TODO: Still works, but is flagged as deprecated. See: https://developer.mozilla.org/en-US/docs/Web/CSS/box-orient
                  WebkitLineClamp: '2',
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
