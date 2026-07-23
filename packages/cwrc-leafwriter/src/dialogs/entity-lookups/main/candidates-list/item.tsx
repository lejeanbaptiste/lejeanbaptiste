import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Chip,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Authority, AuthorityLookupResult } from '../../../../types/authority';
import { lookupTypeAtom, selectedAtom } from '../../store';
import { useEntityLookup } from '../../useEntityLookup';

interface Props extends AuthorityLookupResult {
  authority: Authority | (string & {});
  /** True when this result is sourced from the user's own database (PEDB/CEDB). */
  isOwnDatabase?: boolean;
}

export const Item = ({ authority, description, internal, isOwnDatabase, label, uri }: Props) => {
  const lookupType = useAtomValue(lookupTypeAtom);
  const [selected, setSelected] = useAtom(selectedAtom);

  const { confirmSelected } = useEntityLookup();
  const [hover, setHover] = useState(false);

  const handleOnDoubleClick = () => {
    if (uri !== selected?.uri) return;
    void confirmSelected();
  };

  return (
    <ListItem
      dense
      disablePadding
      onClick={() =>
        setSelected({ authority, entityType: lookupType, label, uri, description, internal })
      }
      onDoubleClick={handleOnDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      secondaryAction={
        !internal && (
          <IconButton aria-label="open-uri" edge="end" href={uri} size="small" target="_blank">
            {hover && <OpenInNewIcon fontSize="inherit" />}
          </IconButton>
        )
      }
      sx={{ my: 0.5 }}
    >
      <ListItemButton
        selected={selected?.uri === uri}
        sx={[
          { borderRadius: 1 },
          isOwnDatabase
            ? {
                backgroundColor: '#e8f5e9',
                '&:hover': { backgroundColor: '#c8e6c9' },
              }
            : {},
          (theme) =>
            isOwnDatabase
              ? theme.applyStyles('dark', {
                  backgroundColor: 'rgba(46, 125, 50, 0.16)',
                })
              : {},
        ]}
      >
        <ListItemText
          primary={label}
          secondary={
            internal ? (
              <Stack component="span" spacing={0.25}>
                <Stack alignItems="center" component="span" direction="row" spacing={0.5}>
                  <Typography
                    component="span"
                    sx={{ fontFamily: 'monospace' }}
                    variant="caption"
                  >
                    {internal.id}
                  </Typography>
                  {[...new Set(internal.idnos.map((idno) => idno.type))]
                    .filter((type) => type !== 'ljb-entity-database')
                    .map((type) => (
                      <Chip
                        key={type}
                        label={type}
                        size="small"
                        sx={{ fontSize: '0.65rem', height: 16 }}
                        variant="outlined"
                      />
                    ))}
                </Stack>
                {internal.description && (
                  <Typography color="textSecondary" component="span" noWrap variant="caption">
                    {internal.description}
                  </Typography>
                )}
              </Stack>
            ) : (
              description && (
                <Typography
                  color="textSecondary"
                  sx={[
                    {
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: '2',
                      transition: '0.4s',
                      WebkitBoxOrient: 'vertical', // TODO: Still works, but is flagged as deprecated. See: https://developer.mozilla.org/en-US/docs/Web/CSS/box-orient
                    },
                    selected?.uri === uri && { display: 'block', overflow: 'auto' },
                  ]}
                  variant="body2"
                >
                  {description}
                </Typography>
              )
            )
          }
        />
      </ListItemButton>
    </ListItem>
  );
};
