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

export const openApplicationSettings = async (): Promise<boolean> => {
  if (!isDesktop()) return false;

  const openDialog = () => {
    if (window.writer) {
      window.writer.overmindActions.ui.openDialog({ type: 'settings' });
      return true;
    }

    const leafWriter = getDefaultStore().get(leafwriterAtom);
    if (leafWriter) {
      void leafWriter.showSettingsDialog();
      return true;
    }

    return false;
  };

  if (window.writer) return openDialog();

  if (!ensureLeafWriterReady) return false;

  if (!(await waitForLeafWriterLib())) return false;

  const ready = await ensureLeafWriterReady();
  if (!ready) return false;

  return openDialog();
};
