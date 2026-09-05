jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/grognard-java-test',
  },
}));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getJreReleaseForPlatform,
  isManagedJavaPath,
  parseJavaMajorVersion,
  resolveJavaBinaryInTree,
} from './languageToolJre';

describe('languageTool JRE helpers', () => {
  test('parseJavaMajorVersion reads modern and legacy formats', () => {
    expect(parseJavaMajorVersion('openjdk version "17.0.9" 2023-10-17')).toBe(17);
    expect(parseJavaMajorVersion('java version "1.8.0_381"')).toBe(8);
    expect(parseJavaMajorVersion('openjdk version "21.0.1"')).toBe(21);
    expect(parseJavaMajorVersion('garbage')).toBeNull();
  });

  test('getJreReleaseForPlatform covers macOS, Windows, and win-arm64 fallback', () => {
    expect(getJreReleaseForPlatform('darwin', 'arm64')?.archive).toBe('tar.gz');
    expect(getJreReleaseForPlatform('darwin', 'x64')?.archive).toBe('tar.gz');
    expect(getJreReleaseForPlatform('win32', 'x64')?.archive).toBe('zip');
    expect(getJreReleaseForPlatform('win32', 'arm64')?.fileName).toContain('x64_windows');
    expect(getJreReleaseForPlatform('linux', 'x64')).toBeNull();
  });

  test('resolveJavaBinaryInTree finds macOS and flat bin layouts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grognard-jre-'));
    const javaName = process.platform === 'win32' ? 'java.exe' : 'java';

    const macTree = path.join(root, 'mac');
    const macJava = path.join(macTree, 'Contents', 'Home', 'bin', javaName);
    fs.mkdirSync(path.dirname(macJava), { recursive: true });
    fs.writeFileSync(macJava, '');
    expect(resolveJavaBinaryInTree(macTree)).toBe(macJava);

    const flatTree = path.join(root, 'flat');
    const flatJava = path.join(flatTree, 'bin', javaName);
    fs.mkdirSync(path.dirname(flatJava), { recursive: true });
    fs.writeFileSync(flatJava, '');
    expect(resolveJavaBinaryInTree(flatTree)).toBe(flatJava);
  });

  test('isManagedJavaPath recognizes userData grognard-java paths', () => {
    expect(
      isManagedJavaPath('/tmp/grognard-java-test/grognard-java/runtime/Contents/Home/bin/java'),
    ).toBe(true);
    expect(isManagedJavaPath('/usr/bin/java')).toBe(false);
  });
});
