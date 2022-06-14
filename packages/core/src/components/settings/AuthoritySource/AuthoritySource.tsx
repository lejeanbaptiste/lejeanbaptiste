import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RemoveIcon from '@mui/icons-material/Remove';
import { Grid, IconButton, Paper, Stack, ToggleButton, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState, type FC } from 'react';
import { ILookupService, LookupsEntityType } from '../../../components/entityLookups/types';
import { useActions, useAppState } from '../../../overmind';
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

  // const handleAuthorityToogle = (event: ChangeEvent<HTMLInputElement>) => {
  //   if (id === 'geonames') {
  //     const source = authorities?.[id];
  //     if (source && !source.config?.username) {
  //       enqueueSnackbar('You must provide a username to make requests to GeoNames.', {
  //         variant: 'error',
  //       });
  //       return;
  //     }
  //   }
  //   toggleLookupAuthority(id);
  // };

  const handleAuthorityToogle = () => {
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
      elevation={isDragging ? 8 : 1}
      ref={setNodeRef}
      square
      style={style}
      sx={{
        zIndex: isDragging ? 1 : 0,
        backgroundColor: isDragging ? ({ palette }) => palette.background.paper : 'transparent',
        cursor: isDragging ? 'grabbing' : 'default',
        borderRadius: 1,
      }}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseUp={handleHadleMouseUp}
    >
      <Grid container sx={{ height: 34, pl: 0.5 }}>
        <Grid item xs={5}>
          <Stack direction="row" spacing={1} alignItems="center" pt={0.25}>
            <ToggleButton
              color="primary"
              onChange={handleAuthorityToogle}
              selected={enabled}
              size="small"
              sx={{ border: 0 }}
              value={enabled}
            >
              {enabled ? (
                <RemoveIcon sx={{ height: 16, width: 16, transform: 'rotate(90deg)' }} />
              ) : (
                <CircleOutlinedIcon sx={{ height: 16, width: 16 }} />
              )}
            </ToggleButton>
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
