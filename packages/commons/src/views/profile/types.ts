import type { IconName } from '@src/icons';
import { type MouseEvent } from 'react';

export type ViewType = 'main' | 'appearance' | 'language' | 'identity' | 'storage';

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

export interface SubMenu {
  onBack: () => void;
  onClose: () => void;
  width?: number;
}
