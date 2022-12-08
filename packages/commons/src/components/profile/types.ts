import { type MouseEvent } from 'react';
export interface OptionProps {
  id: string;
  label: string | React.ReactNode;
  icon?: string;
  secondaryIcon?: string;
  primaryAction?: string;
  action?: (event?: MouseEvent) => void;
  secondaryAction?: string;
  hide?: boolean;
}
