import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton, Paper, Stack, ToggleButton, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { MdAdjust, MdOutlineCircle } from 'react-icons/md';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { toggleLookupAuthorityAtom, toggleLookupEntityAtom } from '../../../../jotai/entity-lookup';
import type { AuthorityService, NamedEntityType } from '../../../../types';
import { EntityType } from './EntityType';

interface AuthorityProps {
  authorityService: AuthorityService;
}

export const Authority = ({ authorityService }: AuthorityProps) => {
  const { disabled, entities, id, name } = authorityService;

  const toggleLookupAuthority = useSetAtom(toggleLookupAuthorityAtom);
  const toggleLookupEntity = useSetAtom(toggleLookupEntityAtom);

  const [hover, setHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleHadleMouseDown = () => setIsDragging(true);

  useEffect(() => {}, [disabled]);

  return (
    <Paper
      elevation={isDragging ? 8 : hover ? 1 : 0}
      ref={setNodeRef}
      square
      style={style}
      sx={[
        { borderRadius: 1, backgroundColor: 'transparent', cursor: 'default', zIndex: 0 },
        isDragging && {
          zIndex: 1,
          backgroundColor: (theme) => theme.vars.palette.background.paper,
          cursor: 'grabbing',
        },
      ]}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => setIsDragging(false)}
    >
      <Stack direction="row">
        <Grid container alignItems="center" sx={{ width: '100%', minHeight: 34, pl: 0.5 }}>
          <Grid size={{ xs: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButton
                color="primary"
                onChange={() => toggleLookupAuthority(id)}
                selected={!disabled}
                size="small"
                sx={{ border: 0 }}
                value={!disabled}
              >
                {!!disabled ? (
                  <MdOutlineCircle style={{ height: 12, width: 12 }} />
                ) : (
                  <MdAdjust style={{ height: 12, width: 12 }} />
                )}
              </ToggleButton>
              <Typography sx={{ cursor: 'default' }} variant="body2">
                {name}
              </Typography>
            </Stack>
          </Grid>
          {Object.entries(entities).map(([entityName, entityEnabled]) => (
            <Grid key={entityName} sx={{ width: 28 }}>
              <EntityType
                available={!disabled}
                enabled={entityEnabled}
                onClick={(entityName) => toggleLookupEntity({ authorityId: id, entityName })}
                name={entityName as NamedEntityType}
              />
            </Grid>
          ))}
        </Grid>
        <IconButton
          {...attributes}
          {...listeners}
          disableRipple
          onMouseDown={hover ? handleHadleMouseDown : undefined}
          size="small"
          sx={{ cursor: !hover ? 'default' : isDragging ? 'grabbing' : 'grab' }}
        >
          <RxDragHandleDots2
            fontSize="inherit"
            style={{ pointerEvents: 'none', transition: 'height 0.3s', height: hover ? 18 : 0 }}
          />
        </IconButton>
      </Stack>
    </Paper>
  );
};
