import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import { Icon, IconButton, useTheme } from '@mui/material';
import { useMemo, useState } from 'react';
import { getIcon } from '../../../../icons';
import type { NamedEntityType } from '../../../../types';

interface EntityTypeProps {
  available: boolean;
  enabled: boolean;
  onClick: (name: NamedEntityType) => void;
  name: NamedEntityType;
}

export const EntityType = ({ available, enabled, onClick, name }: EntityTypeProps) => {
  const { entity, palette } = useTheme();
  const [hover, setHover] = useState(false);

  const IconComponent = useMemo(() => {
    if (name && Object.keys(entity).includes(name)) {
      const entityType = Object.entries(entity).find(([type]) => type === name);
      if (entityType) return getIcon(entityType[1].icon ?? 'unknown');
    }
    return getIcon('unknown');
  }, [name]);

  const handleClick = () => onClick(name);

  const handleMouseOver = () => setHover(true);
  const handleMouseOut = () => setHover(false);

  return (
    <IconButton
      disabled={!available}
      size="small"
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      sx={{ borderRadius: 1 }}
    >
      <Icon
        component={IconComponent}
        fontSize="inherit"
        sx={{ opacity: enabled ? 1 : 0.2, color: hover ? palette.text.primary : 'inherit' }}
      />
      {(!enabled || !available) && (
        <DoNotDisturbAltIcon
          fontSize="inherit"
          sx={{ position: 'absolute', top: 11, left: 17, width: 10 }}
        />
      )}
    </IconButton>
  );
};
