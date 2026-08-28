import type { DialogBarProps } from '../dialogs/type';

type OpenHostDialog = (dialog: DialogBarProps) => void;
type HostNotify = (message: string) => void;

let openHostDialog: OpenHostDialog | null = null;
let hostNotify: HostNotify | null = null;

declare global {
  interface Window {
    __ljbHostDialogBridge?: {
      openDialog: OpenHostDialog;
      notify: HostNotify;
    };
  }
}

/** Registered from the project shell so plugin UI works without TinyMCE / ``window.writer``. */
export function registerHostDialogBridge(open: OpenHostDialog, notify: HostNotify): void {
  openHostDialog = open;
  hostNotify = notify;
  window.__ljbHostDialogBridge = { openDialog: open, notify };
}

export function clearHostDialogBridge(): void {
  openHostDialog = null;
  hostNotify = null;
  delete window.__ljbHostDialogBridge;
}

export function openHostDialogIfReady(dialog: DialogBarProps): boolean {
  const open = openHostDialog ?? window.__ljbHostDialogBridge?.openDialog;
  if (!open) return false;
  open(dialog);
  return true;
}

export function notifyViaHostBridge(message: string): void {
  (hostNotify ?? window.__ljbHostDialogBridge?.notify)?.(message);
}
