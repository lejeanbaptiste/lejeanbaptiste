import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { alpha, Grid, IconButton, Paper, Stack, Switch, Typography } from '@mui/material';
import { ILookupService, LookupsEntityType } from '../../../../components/entityLookups/types';
import { useActions, useAppState } from '../../../../overmind';
import { useSnackbar } from 'notistack';
import React, { ChangeEvent, FC, useState } from 'react';
import NamedEntityOption from './NamedEntityOption';

interface AuthoritySource {
  authority: ILookupService;
}

const AuthoritySource: FC<AuthoritySource> = ({ authority: { enabled, entities, id, name } }) => {
  const { toggleLookupAuthority, toggleLookupEntity } = useActions().editor;
  const { authorities } = useAppState().editor.lookups;
  const { enqueueSnackbar } = useSnackbar();
  const [hover, setHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleMouseOver = () => setHover(true);
  const handleMouseOut = () => setHover(false);

  const handleHadleMouseDown = () => setIsDragging(true);
  const handleHadleMouseUp = () => setIsDragging(false);

  const getNamedEntity = (name: LookupsEntityType) => {
    const entity = entities[name];
    if (!entity) return;
    return <NamedEntityOption available={enabled} entity={entity} onClick={handleEntityToggle} />;
  };

  const handleAuthorityToogle = (event: ChangeEvent<HTMLInputElement>) => {
    if (id === 'geonames') {
      const source = authorities?.[id];
      if (source && !source.config?.username) {
        enqueueSnackbar('You must provide a username to make requests to GeoNames.', {
          variant: 'error',
        });
        return;
      }
    }
    toggleLookupAuthority(id);
  };

  const handleEntityToggle = (entityName: LookupsEntityType) => {
    toggleLookupEntity({ authorityId: id, entityName });
  };

  return (
    <Paper
      elevation={isDragging ? 8 : 0}
      ref={setNodeRef}
      square
      style={style}
      sx={{
        zIndex: isDragging ? 1 : 0,
        backgroundColor: isDragging ? ({ palette }) => palette.background.paper : 'transparent',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseUp={handleHadleMouseUp}
    >
      <Grid
        container
        sx={{
          height: 28,
          pl: 1,
          backgroundColor:
            hover && !isDragging
              ? ({ palette }) =>
                  palette.mode === 'dark'
                    ? alpha(palette.common.black, 0.15)
                    : alpha(palette.common.black, 0.05)
              : 'transparent',
        }}
      >
        <Grid item xs={5}>
          <Stack direction="row" spacing={1} alignItems="center" pt={0.25}>
            <Switch checked={enabled} onChange={handleAuthorityToogle} size="small" />
            <Typography sx={{ cursor: 'default', textTransform: 'capitalize' }} variant="body2">
              {name ?? id}
            </Typography>
          </Stack>
        </Grid>
        <Grid item sx={{ width: 28 }}>
          {getNamedEntity('person')}
        </Grid>
        <Grid item sx={{ width: 28 }}>
          {getNamedEntity('place')}
        </Grid>
        <Grid item sx={{ width: 28 }}>
          {getNamedEntity('organization')}
        </Grid>
        <Grid item sx={{ width: 28 }}>
          {getNamedEntity('title')}
        </Grid>
        <Grid item sx={{ width: 28, pr: 1 }}>
          {getNamedEntity('rs')}
        </Grid>
        <Grid item sx={{ width: 20 }}>
          <IconButton
            {...attributes}
            {...listeners}
            disableRipple
            onMouseDown={hover ? handleHadleMouseDown : undefined}
            size="small"
            sx={{ cursor: !hover ? 'default' : isDragging ? 'grabbing' : 'grab' }}
          >
            <DragIndicatorIcon
              fontSize="inherit"
              sx={{ pointerEvents: 'none', transition: 'height 0.3s', height: hover ? 18 : 0 }}
            />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default AuthoritySource;
