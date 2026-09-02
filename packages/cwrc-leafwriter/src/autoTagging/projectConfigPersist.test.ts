import { persistProjectConfigPatch } from './projectConfigPersist';

describe('persistProjectConfigPatch', () => {
  const bundle = {
    rootPath: '/tmp/proj',
    projectFilePath: '/tmp/proj/jean-baptiste.project.json',
    config: { autoTaggingAuthority: { matchAcrossLineBreaks: true } },
  };

  afterEach(() => {
    delete window.__leafWriterProject;
    delete window.electronAPI;
  });

  it('returns false when the desktop bridge is unavailable', async () => {
    await expect(persistProjectConfigPatch({ syncToCentral: true })).resolves.toBe(false);
  });

  it('writes through electron and applies the returned bundle', async () => {
    const applyProjectConfigBundle = jest.fn();
    const updateProjectFileConfig = jest.fn().mockResolvedValue(bundle);
    window.__leafWriterProject = {
      getProjectFilePath: () => bundle.projectFilePath,
      getAutoTaggingAuthoritySettings: () => undefined,
      setAutoTaggingAuthoritySettings: () => undefined,
      applyProjectConfigBundle,
    };
    window.electronAPI = { updateProjectFileConfig } as unknown as Window['electronAPI'];

    await expect(
      persistProjectConfigPatch({ autoTaggingAuthority: { matchAcrossLineBreaks: true } }),
    ).resolves.toBe(true);

    expect(updateProjectFileConfig).toHaveBeenCalledWith(bundle.projectFilePath, {
      autoTaggingAuthority: { matchAcrossLineBreaks: true },
    });
    expect(applyProjectConfigBundle).toHaveBeenCalledWith(bundle);
  });
});
