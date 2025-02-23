import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton, Paper, Stack, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { MdAdjust, MdOutlineCircle } from 'react-icons/md';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { authorityServicesAtom } from '../../../../jotai/entity-lookup';
import type { LookupServicePreference } from '../../../../types';
import { useLookupServicePrefeneces } from './useLookupEntity';

export const Authority = ({
  servicePreference,
}: {
  servicePreference: LookupServicePreference;
}) => {
  const { authorityId, disabled, entityType, id } = servicePreference;

  const serviceAuthority = useAtomValue(authorityServicesAtom).get(authorityId);

  const { toggleLookupEntity } = useLookupServicePrefeneces();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const [hover, setHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleHadleMouseDown: React.MouseEventHandler<HTMLElement> = (event) => {
    //if click on the toggle button, do not start dragging. Toggle the entity lookup instead.
    if ((event.target as HTMLElement).tagName === 'BUTTON') {
      toggleLookupEntity(authorityId, entityType);
      return;
    }

    if (!!disabled) return;

    setIsDragging(true);
  };

  return (
    <Paper
      ref={setNodeRef}
      elevation={isDragging ? 8 : hover && !disabled ? 1 : 0}
      square
      style={style}
      sx={[
        {
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          minHeight: 28,
          backgroundColor: 'transparent',
          borderRadius: 1,
          cursor: 'default',
        },
        hover && !disabled && { cursor: 'grab' },
        isDragging && {
          zIndex: 1,
          backgroundColor: (theme) => theme.vars.palette.background.paper,
          cursor: 'grabbing',
        },
      ]}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => setIsDragging(false)}
      {...attributes}
      {...listeners}
      onMouseDown={handleHadleMouseDown}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%" mx={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton id="toogle-lookup-entity" color="primary" size="small" sx={{ border: 0 }}>
            {!!disabled ? (
              <MdOutlineCircle style={{ height: 12, width: 12, pointerEvents: 'none' }} />
            ) : (
              <MdAdjust style={{ height: 12, width: 12, pointerEvents: 'none' }} />
            )}
          </IconButton>
          <Typography
            color={!!disabled ? 'text.secondary' : 'inherit'}
            sx={{
              textDecoration: !!disabled ? 'line-through' : 'none',
              cursor: 'default',
              pointerEvents: 'none',
            }}
            variant="body2"
          >
            {serviceAuthority?.name}
          </Typography>
        </Stack>
        <RxDragHandleDots2
          style={{
            width: hover && !disabled ? 14 : 0,
            height: hover && !disabled ? 14 : 0,
            pointerEvents: 'none',
            transition: 'all 0.4s',
          }}
        />
      </Stack>
    </Paper>
  );
};
