jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/ljb-lt-test',
  },
}));

import {
  resolveLanguageToolCheckBaseUrl,
  sanitizeLanguageToolSettings,
  DEFAULT_LANGUAGE_TOOL_SETTINGS,
} from './languageTool';
import { parseJavaMajorVersion } from './languageToolJre';

describe('languageTool managed helpers', () => {
  test('parseJavaMajorVersion reads modern and legacy formats', () => {
    expect(parseJavaMajorVersion('openjdk version "17.0.9" 2023-10-17')).toBe(17);
    expect(parseJavaMajorVersion('java version "1.8.0_381"')).toBe(8);
    expect(parseJavaMajorVersion('openjdk version "21.0.1"')).toBe(21);
    expect(parseJavaMajorVersion('garbage')).toBeNull();
  });

  test('sanitize includes checkMode and managed flags', () => {
    expect(sanitizeLanguageToolSettings(undefined)).toEqual(DEFAULT_LANGUAGE_TOOL_SETTINGS);
    expect(
      sanitizeLanguageToolSettings({
        enabled: true,
        checkMode: 'live',
        managedInstall: true,
        ngramsEnabled: true,
        installedVersion: '6.6',
      }),
    ).toMatchObject({
      enabled: true,
      checkMode: 'live',
      managedInstall: true,
      ngramsEnabled: true,
      installedVersion: '6.6',
    });
  });

  test('resolveLanguageToolCheckBaseUrl prefers managed port', () => {
    const managed = sanitizeLanguageToolSettings({
      managedInstall: true,
      baseUrl: 'http://example.com:9999',
    });
    expect(resolveLanguageToolCheckBaseUrl(managed, 8010)).toBe('http://127.0.0.1:8010');

    const byo = sanitizeLanguageToolSettings({
      managedInstall: false,
      baseUrl: 'http://localhost:8081/',
    });
    expect(resolveLanguageToolCheckBaseUrl(byo)).toBe('http://localhost:8081');
  });
});
