jest.mock('electron', () => ({
  app: { getPath: () => '/tmp/grognard-plugin-registry-test' },
}));

jest.mock('./pluginHost', () => ({
  getPluginHostSnapshot: jest.fn(),
  installPluginFromDirectory: jest.fn(),
}));

import { selectPluginUpdates } from './pluginRegistry';
import type { PluginReleaseIndex } from '../../../commons/src/desktop/pluginRegistryTypes';

const remote = (...plugins: { id: string; version: string }[]): PluginReleaseIndex => ({
  schemaVersion: 1,
  builtAt: '2026-01-01T00:00:00.000Z',
  plugins: plugins.map((p) => ({
    id: p.id,
    name: p.id,
    version: p.version,
    description: '',
    license: 'MIT',
    manifest: { id: p.id },
    fileName: `${p.id}-${p.version}.tar.gz`,
    bytes: 1,
    sha256: 'a'.repeat(64),
  })),
});

describe('selectPluginUpdates', () => {
  it('returns entries whose version differs from the installed one', () => {
    const picked = selectPluginUpdates(
      [
        { id: 'norbert', version: '1.0.0' },
        { id: 'sanmiao', version: '2.1.0' },
      ],
      remote({ id: 'norbert', version: '1.1.0' }, { id: 'sanmiao', version: '2.1.0' }),
    );
    expect(picked.map((e) => e.id)).toEqual(['norbert']);
  });

  it('never selects a plugin that is not installed', () => {
    const picked = selectPluginUpdates(
      [{ id: 'norbert', version: '1.0.0' }],
      remote({ id: 'norbert', version: '1.0.0' }, { id: 'brand-new', version: '0.1.0' }),
    );
    expect(picked).toEqual([]);
  });

  it('skips plugin folders that failed to parse', () => {
    const picked = selectPluginUpdates(
      [{ id: 'broken', version: '?', manifestError: 'Missing manifest' }],
      remote({ id: 'broken', version: '3.0.0' }),
    );
    expect(picked).toEqual([]);
  });

  it('treats any inequality as an update, including a downgrade in the registry', () => {
    const picked = selectPluginUpdates(
      [{ id: 'norbert', version: '2.0.0' }],
      remote({ id: 'norbert', version: '1.9.0' }),
    );
    expect(picked.map((e) => e.id)).toEqual(['norbert']);
  });
});
