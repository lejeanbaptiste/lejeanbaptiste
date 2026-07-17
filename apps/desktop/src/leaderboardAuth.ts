/**
 * GitHub OAuth Device Flow login for the leaderboard, plus a locally
 * cached access token so a player only does this once. The token only
 * ever proves identity (scope is empty - just enough for GET /user); it
 * cannot access the org, its repos, or anything else. The Worker at
 * ljb-leaderboard.lejeanbaptiste.workers.dev re-verifies it against
 * GitHub itself on every submission rather than trusting the cache blindly.
 */

import { app, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';

// Public by design - OAuth Device Flow client IDs are meant to ship in
// client applications, unlike the Worker's write PAT (never here).
const CLIENT_ID = 'Ov23liCsejVjOmx4PCBm';
const AUTH_FILENAME = 'leaderboard-auth.json';

const getAuthPath = () => path.join(app.getPath('userData'), AUTH_FILENAME);

export const getCachedLeaderboardToken = async (): Promise<string | null> => {
  try {
    const raw = await fs.readFile(getAuthPath(), 'utf-8');
    const parsed = JSON.parse(raw) as { token?: string };
    return typeof parsed.token === 'string' ? parsed.token : null;
  } catch {
    return null;
  }
};

const cacheLeaderboardToken = async (token: string): Promise<void> => {
  await fs.writeFile(getAuthPath(), JSON.stringify({ token }, null, 2), 'utf-8');
};

export const clearCachedLeaderboardToken = async (): Promise<void> => {
  try {
    await fs.unlink(getAuthPath());
  } catch {
    // Nothing to clear.
  }
};

export interface DeviceFlowStart {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}

export const startLeaderboardDeviceFlow = async (): Promise<DeviceFlowStart> => {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID }).toString(),
  });
  const data = (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    expires_in: number;
  };
  await shell.openExternal(data.verification_uri);
  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    deviceCode: data.device_code,
    interval: data.interval,
    expiresIn: data.expires_in,
  };
};

/** Polls until the player finishes authorizing (or the code expires). */
export const pollLeaderboardDeviceFlow = async (
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
): Promise<{ token: string } | { error: string }> => {
  const deadline = Date.now() + expiresInSeconds * 1000;
  let waitSeconds = intervalSeconds;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }).toString(),
    });
    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      interval?: number;
    };

    if (data.access_token) {
      await cacheLeaderboardToken(data.access_token);
      return { token: data.access_token };
    }
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      waitSeconds = data.interval ?? waitSeconds + 5;
      continue;
    }
    return { error: data.error ?? 'Device flow failed.' };
  }
  return { error: 'Timed out waiting for authorization.' };
};
