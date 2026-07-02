import type { CslJsonItem } from './types';

/**
 * Renderer-side access to the Zotero IPC bridge (apps/desktop/src/zoteroClient.ts via
 * preload). Typed structurally rather than importing from apps/desktop so this package
 * stays decoupled from the Electron build.
 */

export interface ZoteroAvailability {
  running: boolean;
  localApi: boolean;
  betterBibtex: boolean;
}

export interface ZoteroSearchResult {
  uri: string;
  csl: CslJsonItem;
}

export interface ZoteroCaywPick extends ZoteroSearchResult {
  locator?: string;
  label?: string;
  prefix?: string;
  suffix?: string;
}

export type ZoteroCaywResult =
  | { ok: true; picks: ZoteroCaywPick[] }
  | { ok: false; cancelled: boolean; error?: string };

interface ZoteroBridge {
  zoteroCheckAvailability?: () => Promise<ZoteroAvailability>;
  zoteroSearchItems?: (query: string) => Promise<ZoteroSearchResult[]>;
  zoteroPickCitation?: () => Promise<ZoteroCaywResult>;
  zoteroCancelPick?: () => Promise<void>;
}

const bridge = (): ZoteroBridge =>
  (window as { electronAPI?: ZoteroBridge }).electronAPI ?? {};

export const checkZoteroAvailability = async (): Promise<ZoteroAvailability> => {
  const check = bridge().zoteroCheckAvailability;
  if (!check) return { running: false, localApi: false, betterBibtex: false };
  return check();
};

export const searchZoteroItems = async (query: string): Promise<ZoteroSearchResult[]> => {
  const search = bridge().zoteroSearchItems;
  if (!search) throw new Error('Zotero lookup is only available in the desktop app.');
  return search(query);
};

export const pickZoteroCitation = async (): Promise<ZoteroCaywResult> => {
  const pick = bridge().zoteroPickCitation;
  if (!pick) return { ok: false, cancelled: false, error: 'Desktop app required.' };
  return pick();
};

export const cancelZoteroPick = async (): Promise<void> => {
  await bridge().zoteroCancelPick?.();
};

/** User-facing guidance for each unavailable state, shown in the picker dialog. */
export const zoteroStatusMessage = (availability: ZoteroAvailability): string | undefined => {
  if (!availability.running) {
    return 'Zotero is not running. Start Zotero 7 to insert citations.';
  }
  if (!availability.localApi && !availability.betterBibtex) {
    return 'Enable the local API in Zotero (Settings → Advanced → "Allow other applications on this computer to communicate with Zotero") or install the Better BibTeX plugin.';
  }
  return undefined;
};
