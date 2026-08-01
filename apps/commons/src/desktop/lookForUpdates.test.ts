import { describe, expect, it } from 'vitest';

import { everythingIsUpToDate, type LookForUpdatesReport } from './lookForUpdates';

const base = (): LookForUpdatesReport => ({
  app: { status: 'current' },
  authority: null,
  pluginUpdates: 0,
  schema: null,
});

describe('everythingIsUpToDate', () => {
  it('is true when every channel is current or N/A', () => {
    expect(everythingIsUpToDate(base())).toBe(true);
    expect(
      everythingIsUpToDate({
        ...base(),
        app: { status: 'unsupported' },
        authority: {
          enabled: true,
          updateAvailable: false,
        } as LookForUpdatesReport['authority'],
        schema: { status: 'skipped', reason: 'Not a catalog-installed schema' },
      }),
    ).toBe(true);
  });

  it('is false when authority packs need a refresh', () => {
    expect(
      everythingIsUpToDate({
        ...base(),
        authority: {
          enabled: true,
          updateAvailable: true,
        } as LookForUpdatesReport['authority'],
      }),
    ).toBe(false);
  });

  it('is false when plugins or the app need attention', () => {
    expect(everythingIsUpToDate({ ...base(), pluginUpdates: 2 })).toBe(false);
    expect(
      everythingIsUpToDate({
        ...base(),
        app: { status: 'updateAvailable', version: '1.2.3' },
      }),
    ).toBe(false);
  });
});
