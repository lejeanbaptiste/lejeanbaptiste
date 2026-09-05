import { createHash } from 'node:crypto';
import { __testing } from './r2Client';

const { signRequest, canonicalUri, canonicalQuery } = __testing;

const CONFIG = {
  endpoint: 'https://acct123.r2.cloudflarestorage.com',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  bucket: 'grognard-backups',
};
const FIXED_DATE = new Date('2026-09-01T20:30:15.000Z');
const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');

describe('canonicalUri', () => {
  it('encodes each segment but keeps the separators', () => {
    expect(canonicalUri('grognard-backups/snapshots/entities-2026.sqlite.gz')).toBe(
      '/grognard-backups/snapshots/entities-2026.sqlite.gz',
    );
  });

  it('percent-encodes spaces and reserved characters within a segment', () => {
    expect(canonicalUri('bucket/a b+c')).toBe('/bucket/a%20b%2Bc');
  });
});

describe('canonicalQuery', () => {
  it('sorts keys and RFC3986-encodes values', () => {
    expect(canonicalQuery({ prefix: 'a/b c', 'list-type': '2' })).toBe(
      'list-type=2&prefix=a%2Fb%20c',
    );
  });

  it('is empty for no params', () => {
    expect(canonicalQuery({})).toBe('');
  });
});

describe('signRequest', () => {
  it('sets an empty-body content hash and host from the endpoint', () => {
    const { headers, url } = signRequest(CONFIG, 'GET', 'some/key', {}, null, {}, FIXED_DATE);
    expect(headers['x-amz-content-sha256']).toBe(EMPTY_SHA256);
    expect(headers.host).toBe('acct123.r2.cloudflarestorage.com');
    expect(headers['x-amz-date']).toBe('20260901T203015Z');
    expect(url).toBe('https://acct123.r2.cloudflarestorage.com/grognard-backups/some/key');
  });

  it('hashes the body when present', () => {
    const body = Buffer.from('snapshot-bytes');
    const { headers } = signRequest(CONFIG, 'PUT', 'k', {}, body, {}, FIXED_DATE);
    expect(headers['x-amz-content-sha256']).toBe(createHash('sha256').update(body).digest('hex'));
  });

  it('produces a well-formed SigV4 Authorization header for the auto region', () => {
    const { headers } = signRequest(CONFIG, 'GET', 'k', {}, null, {}, FIXED_DATE);
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260901\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });

  it('is deterministic for fixed inputs, and changes when the request changes', () => {
    const base = signRequest(CONFIG, 'GET', 'k', {}, null, {}, FIXED_DATE).headers.authorization;
    const same = signRequest(CONFIG, 'GET', 'k', {}, null, {}, FIXED_DATE).headers.authorization;
    const otherKey = signRequest(CONFIG, 'GET', 'k2', {}, null, {}, FIXED_DATE).headers
      .authorization;
    const otherDate = signRequest(
      CONFIG,
      'GET',
      'k',
      {},
      null,
      {},
      new Date('2026-09-02T00:00:00Z'),
    ).headers.authorization;
    expect(base).toBe(same);
    expect(base).not.toBe(otherKey);
    expect(base).not.toBe(otherDate);
  });

  it('folds a continuation-token query param into the signed URL', () => {
    const { url } = signRequest(
      CONFIG,
      'GET',
      '',
      { 'list-type': '2', prefix: 'entity-db-backups/snapshots/', 'continuation-token': 'a/b+c=' },
      null,
      {},
      FIXED_DATE,
    );
    expect(url).toContain('continuation-token=a%2Fb%2Bc%3D');
    expect(url).toContain('list-type=2');
    expect(url.startsWith('https://acct123.r2.cloudflarestorage.com/grognard-backups?')).toBe(true);
  });
});
