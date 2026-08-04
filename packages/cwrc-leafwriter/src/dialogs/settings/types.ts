import type { IDialog } from '../type';

export type SettingsTabId =
  | 'project'
  | 'profile'
  | 'interface'
  | 'privacy'
  | 'guardrails'
  | 'authorities'
  | 'asset-packs'
  | 'plugins'
  | 'ai';

export interface SettingsDialogProps extends IDialog {
  initialTab?: SettingsTabId;
}
