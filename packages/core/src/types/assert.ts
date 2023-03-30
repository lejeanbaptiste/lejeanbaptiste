import { useTheme } from '@mui/material';
import { EntityType } from '.';

export const isEntityType = (param: string): param is EntityType => {
  const { entity } = useTheme();
  return entity[param as EntityType]?.color !== undefined;
};
