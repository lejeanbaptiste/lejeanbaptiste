import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AdjustIcon from '@mui/icons-material/Adjust';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Grid, Icon, IconButton, Paper, Stack, ToggleButton, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import { AuthorityService, NamedEntityType } from '../../../entityLookups';
import { EntityType } from './EntityType';

interface AuthorityProps {
  authorityService: AuthorityService;
}

export const Authority = ({
  authorityService: { disabled, entities, id, name },
}: AuthorityProps) => {
  const { authorityServices } = useAppState().editor;
  const { toggleLookupAuthority, toggleLookupEntity } = useActions().editor;
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation();

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

  const handleAuthorityToogle = () => toggleLookupAuthority(id);

  const handleEntityToggle = (entityName: NamedEntityType) => {
    toggleLookupEntity({ authorityId: id, entityName });
  };

  return (
    <Paper
      elevation={isDragging ? 8 : hover ? 1 : 0}
      ref={setNodeRef}
      square
      style={style}
      sx={{
        zIndex: isDragging ? 1 : 0,
        bgcolor: isDragging ? ({ palette }) => palette.background.paper : 'transparent',
        borderRadius: 1,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseUp={handleHadleMouseUp}
    >
      <Stack direction="row">
        <Grid container alignItems="center" sx={{ minHeight: 34, pl: 0.5 }}>
          <Grid item xs={5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButton
                color="primary"
                onChange={handleAuthorityToogle}
                selected={!disabled}
                size="small"
                sx={{ border: 0 }}
                value={!disabled}
              >
                <Icon
                  component={disabled ? CircleOutlinedIcon : AdjustIcon}
                  sx={{ height: 12, width: 12 }}
                />
              </ToggleButton>
              <Typography sx={{ cursor: 'default', textTransform: 'capitalize' }} variant="body2">
                {name ?? id}
              </Typography>
            </Stack>
          </Grid>
          {Object.entries(entities).map(([id, entityEnabled]) => (
            <Grid key={id} item sx={{ width: 28 }}>
              <EntityType
                available={disabled ?? true}
                enabled={entityEnabled}
                onClick={handleEntityToggle}
                name={id as NamedEntityType}
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
          <DragIndicatorIcon
            fontSize="inherit"
            sx={{ pointerEvents: 'none', transition: 'height 0.3s', height: hover ? 18 : 0 }}
          />
        </IconButton>
      </Stack>
    </Paper>
  );
};
