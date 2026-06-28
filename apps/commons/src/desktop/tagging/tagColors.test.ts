import {
  emptyTagColorsFile,
  generateTagColorsCss,
  getDefaultTagColor,
  resolveTagColor,
  updateTagColor,
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
});
