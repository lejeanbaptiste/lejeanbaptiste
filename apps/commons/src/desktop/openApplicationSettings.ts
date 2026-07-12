import { leafwriterAtom } from '@src/jotai';
import { isDesktop } from '@src/types/desktop';
import { getDefaultStore } from 'jotai';

type EnsureLeafWriterReady = () => Promise<boolean>;

let ensureLeafWriterReady: EnsureLeafWriterReady | null = null;

export const registerApplicationSettingsBootstrap = (ensureReady: EnsureLeafWriterReady) => {
  ensureLeafWriterReady = ensureReady;
};

const waitForLeafWriterLib = async (timeoutMs = 8000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (getDefaultStore().get(leafwriterAtom)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return false;
};

// On cold start this can be called before ProjectEditor has mounted and
// registered the bootstrap (registration happens in a useEffect, one tick
// after isProjectReady flips true), so poll instead of failing immediately.
const waitForBootstrapRegistered = async (timeoutMs = 8000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (ensureLeafWriterReady) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return false;
};

// The registered bootstrap closure can be one React render stale relative to
// the leafwriter atom it was just confirmed to hold (registration happens in
// a useEffect that fires *after* the atom updates), so a fresh registration
// reliably lands within a tick or two of the atom appearing. Retry instead
// of trusting the first call.
const callEnsureLeafWriterReady = async (timeoutMs = 3000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (ensureLeafWriterReady && (await ensureLeafWriterReady())) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return false;
};

interface OpenApplicationSettingsOptions {
  onClose?: (action?: string) => void;
}

export const openApplicationSettings = async (
  options?: OpenApplicationSettingsOptions,
): Promise<boolean> => {
  if (!isDesktop()) return false;

  const dialogProps = options?.onClose ? { onClose: options.onClose } : undefined;

  const openDialog = () => {
    if (window.writer) {
      window.writer.overmindActions.ui.openDialog({ type: 'settings', props: dialogProps });
      return true;
    }

    const leafWriter = getDefaultStore().get(leafwriterAtom);
    if (leafWriter) {
      void leafWriter.showSettingsDialog(options);
      return true;
    }

    return false;
  };

  if (window.writer) return openDialog();

  if (!(await waitForBootstrapRegistered())) return false;
  if (!(await waitForLeafWriterLib())) return false;
  if (!(await callEnsureLeafWriterReady())) return false;

  return openDialog();
};

/** Opens application settings and resolves once the dialog closes. The dialog
 * blocks closing while required desktop fields (language, name, database
 * folder) are unset, so this only resolves `true` once they're complete. */
export const openApplicationSettingsAndWait = async (): Promise<boolean> => {
  let opened = false;
  const closed = new Promise<void>((resolve) => {
    void openApplicationSettings({ onClose: () => resolve() }).then((result) => {
      opened = result;
      if (!result) resolve();
    });
  });
  await closed;
  return opened;
};
