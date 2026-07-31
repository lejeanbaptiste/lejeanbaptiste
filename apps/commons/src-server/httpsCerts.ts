import { X509Certificate } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ServerOptions } from 'https';
import { getHttpsServerOptions } from 'office-addin-dev-certs';

/**
 * The Word add-in's task pane loads over HTTPS (Office requires this even for
 * localhost), so a plain-HTTP `/api/plugins/*` gets blocked outright as mixed
 * content by Word's WKWebView on macOS — no localhost exception, unlike
 * Chromium. `office-addin-dev-certs` installs a locally-trusted CA (the same
 * one the Word add-in's own dev server uses) and issues a cert covering both
 * `localhost` and `127.0.0.1`, so browsers trust it without a manual prompt.
 *
 * `getHttpsServerOptions` installs the CA into the OS trust store on first
 * use if it isn't there yet (a real, user-visible system-trust change — the
 * same one a Word add-in developer already accepts when running its own dev
 * server; Zotero's Word plugin and other local-companion-app plugins follow
 * the same pattern) — that one-time install is expected and fine.
 *
 * What isn't fine: `getHttpsServerOptions` re-verifies the CA against the
 * keychain via shell commands (`security find-certificate`, …) on *every*
 * call, even when nothing changed — and reading a keychain-protected item can
 * itself trigger a macOS prompt, separate from actually installing anything.
 * Since this server restarts constantly during development (`node --watch`
 * on every source edit), that turns into a prompt-per-restart. So: check
 * ourselves, with no shell-out and no keychain touch, whether a valid-looking
 * cert already exists on disk, and only fall through to the full
 * verify/install dance (which may prompt) when it doesn't.
 */
const CERT_DIR = path.join(os.homedir(), '.office-addin-dev-certs');
const CA_CERT_PATH = path.join(CERT_DIR, 'ca.crt');
const LOCALHOST_CERT_PATH = path.join(CERT_DIR, 'localhost.crt');
const LOCALHOST_KEY_PATH = path.join(CERT_DIR, 'localhost.key');

const existingCertIsStillValid = (): boolean => {
  try {
    const cert = new X509Certificate(fs.readFileSync(LOCALHOST_CERT_PATH));
    const validTo = new Date(cert.validTo).getTime();
    return validTo > Date.now() + 24 * 60 * 60 * 1000; // still valid for at least another day
  } catch {
    return false;
  }
};

export const resolvePluginHttpsOptions = async (): Promise<ServerOptions> => {
  if (existingCertIsStillValid()) {
    return {
      ca: fs.readFileSync(CA_CERT_PATH),
      cert: fs.readFileSync(LOCALHOST_CERT_PATH),
      key: fs.readFileSync(LOCALHOST_KEY_PATH),
    };
  }
  return getHttpsServerOptions();
};
