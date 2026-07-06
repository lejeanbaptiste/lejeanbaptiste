import {
  emptyTagColorsFile,
  generateTagColorsCss,
  getDefaultTagColor,
  injectTagColorsCss,
  loadAndInjectTagColors,
  reapplyCachedTagColors,
  resolveTagColor,
  updateTagColor,
  type TagColorEntry,
} from './tagColors';

describe('tagColors', () => {
  test('generateTagColorsCss emits showTags rules', () => {
    const file = emptyTagColorsFile();
    file.tags.persName = { highlight: '#abc', text: '#123' };
    const css = generateTagColorsCss(file);
    expect(css).toContain("*[_tag='persName']");
    expect(css).toContain("*[_tag='persName'] *");
    expect(css).toContain('background-color: #abc');
    expect(css).toContain('color: #123');
  });

  test('resolveTagColor falls back to defaults', () => {
    const file = emptyTagColorsFile();
    const resolved = resolveTagColor(file, 'persName');
    expect(resolved).toEqual(getDefaultTagColor('persName'));
  });

  test('updateTagColor removes entry when null', async () => {
    const writeFile = jest.fn().mockResolvedValue(undefined);
    (window as unknown as { electronAPI: { writeFile: typeof writeFile; readFile: jest.Mock } }).electronAPI = {
      writeFile,
      readFile: jest.fn().mockRejectedValue(new Error('missing')),
    };

    const updated = await updateTagColor('/proj', 'persName', { highlight: '#fff', text: '#000' });
    expect(updated.tags.persName).toEqual({ highlight: '#fff', text: '#000' });

    const cleared = await updateTagColor('/proj', 'persName', null);
    expect(cleared.tags.persName).toBeUndefined();
  });

  test('updateTagColor preserves other tags under concurrent updates', async () => {
    let stored = '';
    const readFile = jest.fn().mockImplementation(async () => {
      if (!stored) throw new Error('missing');
      return stored;
    });
    const writeFile = jest.fn().mockImplementation(async (_path: string, content: string) => {
      stored = content;
    });
    (window as unknown as { electronAPI: { writeFile: typeof writeFile; readFile: typeof readFile } }).electronAPI = {
      writeFile,
      readFile,
    };

    await Promise.all([
      updateTagColor('/proj', 'persName', { highlight: '#111111', text: '#222222' }),
      updateTagColor('/proj', 'placeName', { highlight: '#333333', text: '#444444' }),
    ]);

    const file = JSON.parse(stored) as { tags: Record<string, TagColorEntry> };
    expect(file.tags.persName).toEqual({ highlight: '#111111', text: '#222222' });
    expect(file.tags.placeName).toEqual({ highlight: '#333333', text: '#444444' });
  });

  test('loadAndInjectTagColors caches css for later editor injection', async () => {
    const cssText = "*[_tag='persName'] { background-color: #abc; }";
    (window as unknown as { electronAPI: { readFile: jest.Mock } }).electronAPI = {
      readFile: jest.fn().mockResolvedValue(JSON.stringify({ version: 1, tags: { persName: { highlight: '#abc' } } })),
      pathExists: jest.fn().mockResolvedValue(true),
    };
    delete (window as unknown as { writer?: unknown }).writer;

    await loadAndInjectTagColors('/proj');
    expect(reapplyCachedTagColors('/proj')).toBe(false);

    const doc = document.implementation.createHTMLDocument('');
    (window as unknown as { writer: { editor: { getDoc: () => Document } } }).writer = {
      editor: { getDoc: () => doc },
    };

    expect(reapplyCachedTagColors('/proj')).toBe(true);
    expect(doc.getElementById('tagColors')?.textContent).toContain("*[_tag='persName']");
    expect(injectTagColorsCss(cssText)).toBe(true);
  });
});
