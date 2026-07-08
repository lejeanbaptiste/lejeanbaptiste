import VirtualEditor from './virtualEditor';
import { processSchema, verifyHash } from './conversion';

jest.mock('./conversion', () => ({
  processSchema: jest.fn(),
  verifyHash: jest.fn(),
}));

jest.mock('./db', () => ({
  db: { cachedSchemas: { get: jest.fn() } },
}));

const mockProcessSchema = processSchema as jest.Mock;
const mockVerifyHash = verifyHash as jest.Mock;
const mockCachedGet = (
  jest.requireMock('./db') as { db: { cachedSchemas: { get: jest.Mock } } }
).db.cachedSchemas.get;

describe('VirtualEditor.initialize', () => {
  beforeEach(() => {
    mockProcessSchema.mockReset();
    mockVerifyHash.mockReset();
    mockCachedGet.mockReset();
    mockVerifyHash.mockResolvedValue(false);
  });

  it('reprocesses when the url changes even if the id (catalogId) is unchanged', async () => {
    const grammarA = { name: 'grammarA' };
    const grammarB = { name: 'grammarB' };
    mockProcessSchema.mockResolvedValueOnce(grammarA).mockResolvedValueOnce(grammarB);

    const editor = new VirtualEditor();

    const first = await editor.initialize({ id: 'teiAll', url: 'blob:project-a' });
    expect(first.success).toBe(true);
    expect(editor.schema).toBe(grammarA);

    const second = await editor.initialize({ id: 'teiAll', url: 'blob:project-b' });
    expect(second.success).toBe(true);
    expect(editor.schema).toBe(grammarB);

    expect(mockProcessSchema).toHaveBeenCalledTimes(2);
  });

  it('skips reprocessing only when both id and url are unchanged', async () => {
    mockProcessSchema.mockResolvedValue({ name: 'grammarA' });

    const editor = new VirtualEditor();
    await editor.initialize({ id: 'teiAll', url: 'blob:project-a' });
    await editor.initialize({ id: 'teiAll', url: 'blob:project-a' });

    expect(mockProcessSchema).toHaveBeenCalledTimes(1);
  });

  it('awaits verifyHash and reprocesses when the cache entry is stale', async () => {
    mockCachedGet.mockResolvedValue({
      gramarJson: '{"stale":true}',
      hash: 'SHA-256-deadbeef',
      url: 'blob:old',
    });
    mockVerifyHash.mockResolvedValue(false);
    mockProcessSchema.mockResolvedValue({ name: 'freshGrammar' });

    const editor = new VirtualEditor();
    const result = await editor.initialize({ id: 'teiAll', url: 'blob:new' });

    expect(result.success).toBe(true);
    expect(mockVerifyHash).toHaveBeenCalledWith('blob:new', expect.any(Object));
    expect(mockProcessSchema).toHaveBeenCalledTimes(1);
    expect(editor.schema).toEqual({ name: 'freshGrammar' });
  });

  it('compiles desktop project schema text without fetch', async () => {
    const grammar = { name: 'projectGrammar' };
    mockProcessSchema.mockResolvedValue(grammar);

    const editor = new VirtualEditor();
    const result = await editor.initialize({
      id: 'project-tei-all',
      url: 'ljb://%2Fproject%2Fschema%2Ftei_all.rng',
      schemaRevision: 'ljb-sanmiao-merge v4',
      schemaText: '<grammar xmlns="http://relaxng.org/ns/structure/1.0"/>',
      shouldCache: false,
    });

    expect(result.success).toBe(true);
    expect(mockProcessSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'project-tei-all',
        url: 'ljb://%2Fproject%2Fschema%2Ftei_all.rng',
        schemaText: '<grammar xmlns="http://relaxng.org/ns/structure/1.0"/>',
        shouldCache: false,
      }),
    );
    expect(editor.schemaUrl).toContain('ljb://');
  });

  it('never reads IndexedDB when shouldCache is false (local project schemas)', async () => {
    mockCachedGet.mockResolvedValue({
      gramarJson: '{"stale":true}',
      hash: 'SHA-256-deadbeef',
      url: 'blob:old',
    });
    mockProcessSchema.mockResolvedValue({ name: 'projectGrammar' });

    const editor = new VirtualEditor();
    await editor.initialize({
      id: 'project-tei-all',
      url: 'blob:project-local',
      shouldCache: false,
    });

    expect(mockCachedGet).not.toHaveBeenCalled();
    expect(mockVerifyHash).not.toHaveBeenCalled();
    expect(mockProcessSchema).toHaveBeenCalledWith({
      id: 'project-tei-all',
      url: 'blob:project-local',
      shouldCache: false,
    });
  });
});
