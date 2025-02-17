import { IconButton } from '@mui/material';
import { useState } from 'react';
import { MdDoDisturb } from 'react-icons/md';
import { Icon } from '../../../../icons';
import type { NamedEntityType } from '../../../../types';

interface EntityTypeProps {
  available: boolean;
  enabled: boolean;
  onClick: (name: NamedEntityType) => void;
  name: NamedEntityType;
}

export const EntityType = ({ available, enabled, onClick, name }: EntityTypeProps) => {
  const [hover, setHover] = useState(false);

  return (
    <IconButton
      disabled={!available}
      size="small"
      onClick={() => onClick(name)}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      sx={{ borderRadius: 1 }}
    >
      <Icon
        name={name}
        fontSize="inherit"
        sx={[
          { opacity: 0.2 },
          enabled && { opacity: 1 },
          hover && { color: (theme) => theme.vars.palette.text.primary },
        ]}
      />
      {(!enabled || !available) && (
        <MdDoDisturb
          fontSize="inherit"
          style={{ position: 'absolute', top: 11, left: 17, width: 10 }}
        />
      )}
    </IconButton>
  );
};
