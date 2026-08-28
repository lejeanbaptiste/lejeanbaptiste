import type { DialogBarProps } from '../dialogs/type';

type OpenHostDialog = (dialog: DialogBarProps) => void;
type HostNotify = (message: string) => void;

let openHostDialog: OpenHostDialog | null = null;
let hostNotify: HostNotify | null = null;

/** Registered from the project shell so plugin UI works without TinyMCE / ``window.writer``. */
export function registerHostDialogBridge(open: OpenHostDialog, notify: HostNotify): void {
  openHostDialog = open;
  hostNotify = notify;
  window.__ljbHostDialogBridge = {
    openDialog: open as unknown as NonNullable<Window['__ljbHostDialogBridge']>['openDialog'],
    notify,
  };
}

export function clearHostDialogBridge(): void {
  openHostDialog = null;
  hostNotify = null;
  delete window.__ljbHostDialogBridge;
}

export function openHostDialogIfReady(dialog: DialogBarProps): boolean {
  const open =
    openHostDialog ?? (window.__ljbHostDialogBridge?.openDialog as OpenHostDialog | undefined);
  if (!open) return false;
  open(dialog);
  return true;
}

export function notifyViaHostBridge(message: string): void {
  (hostNotify ?? window.__ljbHostDialogBridge?.notify)?.(message);
}
