import { resolveTranslationHitTarget } from './translationHitJump';

const translationXml =
  '<translation xml:lang="fr" corresp="chapter1.xml">' +
  '<div corresp="chapter1.xml#ch1">' +
  '<p corresp="chapter1.xml#p1">Bonjour</p>' +
  '<p corresp="chapter1.xml#p2">Le chaton dort</p>' +
  '</div>' +
  '</translation>';

describe('resolveTranslationHitTarget', () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  test('resolves source path, language, and enclosing unit id for a match', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: jest.fn().mockResolvedValue(translationXml),
    } as unknown as typeof window.electronAPI;

    const hitStart = translationXml.indexOf('chaton');
    const hitEnd = hitStart + 'chaton'.length;

    const target = await resolveTranslationHitTarget(
      '/proj/chapter1.fr.translation.xml',
      hitStart,
      hitEnd,
    );

    expect(target).toEqual({
      sourcePath: '/proj/chapter1.xml',
      lang: 'fr',
      unitId: 'p2',
      matchedText: 'chaton',
      offsetInUnitText: { start: 3, end: 9 },
    });
  });

  test('resolves the correct occurrence when the same word appears twice in a unit', async () => {
    const twoOccurrencesXml =
      '<translation xml:lang="fr" corresp="chapter1.xml">' +
      '<p corresp="chapter1.xml#p1">Un chaton, un très mauvais chaton.</p>' +
      '</translation>';

    window.electronAPI = {
      ...originalElectronAPI,
      readFile: jest.fn().mockResolvedValue(twoOccurrencesXml),
    } as unknown as typeof window.electronAPI;

    const firstStart = twoOccurrencesXml.indexOf('chaton');
    const secondStart = twoOccurrencesXml.indexOf('chaton', firstStart + 1);
    expect(secondStart).toBeGreaterThan(firstStart);

    const firstHit = await resolveTranslationHitTarget(
      '/proj/chapter1.fr.translation.xml',
      firstStart,
      firstStart + 'chaton'.length,
    );
    const secondHit = await resolveTranslationHitTarget(
      '/proj/chapter1.fr.translation.xml',
      secondStart,
      secondStart + 'chaton'.length,
    );

    expect(firstHit?.offsetInUnitText).toEqual({ start: 3, end: 9 });
    expect(secondHit?.offsetInUnitText).toEqual({ start: 27, end: 33 });
    expect(firstHit?.offsetInUnitText).not.toEqual(secondHit?.offsetInUnitText);
  });

  test('returns null for a non-translation file path', async () => {
    const target = await resolveTranslationHitTarget('/proj/chapter1.xml', 0, 5);
    expect(target).toBeNull();
  });

  test('falls back to null unitId when the file cannot be read', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: jest.fn().mockRejectedValue(new Error('nope')),
    } as unknown as typeof window.electronAPI;

    const target = await resolveTranslationHitTarget(
      '/proj/chapter1.fr.translation.xml',
      0,
      5,
    );

    expect(target).toEqual({
      sourcePath: '/proj/chapter1.xml',
      lang: 'fr',
      unitId: null,
      matchedText: null,
      offsetInUnitText: null,
    });
  });
});
