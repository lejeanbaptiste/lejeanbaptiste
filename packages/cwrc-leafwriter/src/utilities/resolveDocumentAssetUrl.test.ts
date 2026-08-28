/**
 * @jest-environment node
 */
import { fromLocalFileUrl, isLocalFileUrl, resolveDocumentAssetUrl } from './fetchResource';

describe('resolveDocumentAssetUrl', () => {
  it('passes through absolute ljb and http URLs unchanged', () => {
    const ljb = 'ljb://local/Users/d/project/_gaiji/KR0954.png';
    expect(resolveDocumentAssetUrl(ljb, '/Users/d/project/doc.xml')).toBe(ljb);
    expect(resolveDocumentAssetUrl('https://example.test/x.png', '/any/doc.xml')).toBe(
      'https://example.test/x.png',
    );
  });

  it('resolves document-relative paths against the open XML file', () => {
    const resolved = resolveDocumentAssetUrl(
      '_gaiji/KR0954.png',
      '/Users/d/project/imported/kanripo/KR1a0145/KR1a0145_001.xml',
    );
    expect(isLocalFileUrl(resolved)).toBe(true);
    expect(fromLocalFileUrl(resolved)).toBe(
      '/Users/d/project/imported/kanripo/KR1a0145/_gaiji/KR0954.png',
    );
  });

  it('leaves relative URLs unchanged when the document path is unknown', () => {
    expect(resolveDocumentAssetUrl('_gaiji/KR0954.png', null)).toBe('_gaiji/KR0954.png');
  });
});
