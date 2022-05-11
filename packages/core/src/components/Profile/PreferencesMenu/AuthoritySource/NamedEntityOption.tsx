import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import { IconButton, useTheme } from '@mui/material';
import { ILookupServiceEntity, LookupsEntityType } from '../../../../components/entityLookups/types';
import React, { FC, useState } from 'react';
import useUI from '../../../useUI';

interface NamedEntityOptionProps {
  available: boolean;
  entity: ILookupServiceEntity;
  onClick: (name: LookupsEntityType) => void;
}

const NamedEntityOption: FC<NamedEntityOptionProps> = ({
  available,
  entity: { enabled, name },
  onClick,
}) => {
  const theme = useTheme();
  const { getIcon } = useUI();
  const [hover, setHover] = useState(false);

  const getEntityIcon = () => {
    if (name && Object.keys(theme.entity).includes(name)) {
      const entityType = Object.entries(theme.entity).find(([type]) => type === name);
      return getIcon(entityType?.[1].icon);
    }
  };

  const Icon = name && getEntityIcon();

  const color = () => {
    if (!name) return 'inherent';
    if (name && Object.keys(theme.entity).includes(name)) {
      const entityType = Object.entries(theme.entity).find(([type]) => type === name);
      return enabled ? entityType?.[1].color.main : entityType?.[1].color.light;
    }
  };

  const handleClick = () => {
    onClick(name);
  };

  const handleMouseOver = () => setHover(true);
  const handleMouseOut = () => setHover(false);

  return (
    <IconButton
      disabled={!available}
      size="small"
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      // sx={{ color: hover ? color() : 'inherit' }}
    >
      {Icon && (
        <Icon
          fontSize="inherit"
          sx={{
            opacity: enabled ? 1 : 0.2,
            color: hover ? ({ palette }) => palette.text.primary : 'inherit',
          }}
        />
      )}
      {!enabled && (
        <DoNotDisturbAltIcon
          fontSize="inherit"
          sx={{ position: 'absolute', top: 11, left: 17, width: 10 }}
        />
      )}
    </IconButton>
  );
};

export default NamedEntityOption;
