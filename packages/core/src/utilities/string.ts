import { useTheme } from '@mui/material';
import { EntityType } from '../types';

export const isValidHttpURL = (value: string) => {
  const res = value.match(/^http(s)?\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,6}(\/\S*)?$/);
  return res !== null;
};

export const isEntityType = (param: string): param is EntityType => {
  const { entity } = useTheme();
  return entity[(param as EntityType)]?.color !== undefined;
};