import { Theme } from '@mui/material';
import { EntityType } from '.';

/**
 * Pure predicate — takes the theme's entity map rather than calling `useTheme()`
 * itself, so it can be called conditionally (it was previously breaking the
 * rules of hooks at both call sites).
 */
export const isEntityType = (param: string, entity: Theme['entity']): param is EntityType => {
  return entity[param as EntityType]?.color !== undefined;
};
