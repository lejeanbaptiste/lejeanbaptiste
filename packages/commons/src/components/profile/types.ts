import type { IconName } from '@src/icons';
import { type MouseEvent } from 'react';
export interface OptionProps {
  id: string;
  label: string | React.ReactNode;
  icon?: IconName;
  secondaryIcon?: IconName;
  primaryAction?: string;
  action?: (event?: MouseEvent) => void;
  secondaryAction?: string;
  hide?: boolean;
}
