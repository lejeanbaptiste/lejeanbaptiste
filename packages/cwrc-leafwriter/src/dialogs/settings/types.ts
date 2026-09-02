import type { IDialog } from '../type';

export type SettingsTabId =
  | 'project'
  | 'profile'
  | 'interface'
  | 'translation-policy'
  | 'privacy'
  | 'guardrails'
  | 'authorities'
  | 'asset-packs'
  | 'plugins'
  | 'entity-database'
  | 'ai';

export interface SettingsDialogProps extends IDialog {
  initialTab?: SettingsTabId;
}
