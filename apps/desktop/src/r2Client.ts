/**
 * Minimal S3-compatible client for Cloudflare R2, just enough for the entity
 * database cloud backup (Phase 0 of docs/entity-sync-planning). No AWS SDK: we
 * sign requests with SigV4 by hand and talk to R2's path-style endpoint
 * (`https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>`).
 *
 * Scope on purpose: PUT one object, GET one object, list a prefix, DELETE one
 * object. Region is always `auto` for R2. Bodies are held in memory — the
 * caller (entityDbBackup) keeps snapshots gzipped, tens of MB, well within
 * what a periodic background task can buffer.
 */
import { createHash, createHmac } from 'node:crypto';

export interface R2Config {
  /** e.g. https://<accountId>.r2.cloudflarestorage.com */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
}

const REGION = 'auto';
const SERVICE = 's3';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const sha256Hex = (data: Buffer | string): string =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data, 'utf8').digest();

/** RFC 3986 — encodeURIComponent leaves `!'()*` unescaped; SigV4 wants them escaped. */
const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** Encode each path segment but keep the separators. */
const canonicalUri = (objectPath: string): string =>
  `/${objectPath.split('/').map(encodeRfc3986).join('/')}`;

const canonicalQuery = (query: Record<string, string>): string =>
  Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k])}`)
    .join('&');

const amzDates = (now: Date): { amzDate: string; dateStamp: string } => {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
};

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

const signRequest = (
  config: R2Config,
  method: string,
  objectKey: string,
  query: Record<string, string>,
  body: Buffer | null,
  extraHeaders: Record<string, string> = {},
  now: Date = new Date(),
): SignedRequest => {
  const endpoint = new URL(config.endpoint);
  const { amzDate, dateStamp } = amzDates(now);
  const objectPath = objectKey ? `${config.bucket}/${objectKey}` : config.bucket;
  const uri = canonicalUri(objectPath);
  const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;

  // Header names are compared/sorted lowercase; keep one canonical map.
  const headers: Record<string, string> = {
    host: endpoint.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers[name.toLowerCase()] = value;
  }

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    method,
    uri,
    canonicalQuery(query),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), REGION), SERVICE),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const queryString = canonicalQuery(query);
  return {
    url: `${config.endpoint.replace(/\/$/, '')}${uri}${queryString ? `?${queryString}` : ''}`,
    headers: { ...headers, authorization },
  };
};

const failed = async (context: string, response: Response): Promise<never> => {
  const body = await response.text().catch(() => '');
  const detail = body.match(/<Message>([^<]+)<\/Message>/)?.[1] ?? body.slice(0, 300);
  throw new Error(`R2 ${context} failed (${response.status} ${response.statusText}): ${detail}`);
};

export class R2Client {
  constructor(private readonly config: R2Config) {}

  async putObject(
    key: string,
    body: Buffer,
    options: { contentType?: string; metadata?: Record<string, string> } = {},
  ): Promise<void> {
    const extraHeaders: Record<string, string> = {
      'content-type': options.contentType ?? 'application/octet-stream',
    };
    for (const [name, value] of Object.entries(options.metadata ?? {})) {
      extraHeaders[`x-amz-meta-${name.toLowerCase()}`] = value;
    }
    const { url, headers } = signRequest(this.config, 'PUT', key, {}, body, extraHeaders);
    // `BodyInit` in this project's lib set doesn't line up with the current
    // `Uint8Array<ArrayBufferLike>` variance; a Buffer is a valid fetch body
    // at runtime (undici), so assert past the type mismatch.
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body as unknown as BodyInit,
    });
    if (!response.ok) await failed(`PUT ${key}`, response);
  }

  async getObject(key: string): Promise<Buffer> {
    const { url, headers } = signRequest(this.config, 'GET', key, {}, null);
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) await failed(`GET ${key}`, response);
    return Buffer.from(await response.arrayBuffer());
  }

  async headObjectMetadata(key: string): Promise<Record<string, string> | null> {
    const { url, headers } = signRequest(this.config, 'HEAD', key, {}, null);
    const response = await fetch(url, { method: 'HEAD', headers });
    if (response.status === 404) return null;
    if (!response.ok) await failed(`HEAD ${key}`, response);
    const meta: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (name.startsWith('x-amz-meta-')) meta[name.slice('x-amz-meta-'.length)] = value;
    });
    return meta;
  }

  async deleteObject(key: string): Promise<void> {
    const { url, headers } = signRequest(this.config, 'DELETE', key, {}, null);
    const response = await fetch(url, { method: 'DELETE', headers });
    // R2 returns 204 on success and also on a missing key.
    if (!response.ok && response.status !== 404) await failed(`DELETE ${key}`, response);
  }

  /** List every object under `prefix`, following continuation tokens. */
  async listObjects(prefix: string): Promise<R2Object[]> {
    const objects: R2Object[] = [];
    let continuationToken: string | undefined;

    do {
      const query: Record<string, string> = { 'list-type': '2', prefix };
      if (continuationToken) query['continuation-token'] = continuationToken;
      const { url, headers } = signRequest(this.config, 'GET', '', query, null);
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) await failed(`LIST ${prefix}`, response);
      const xml = await response.text();

      for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
        const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1];
        if (!key) continue;
        objects.push({
          key: decodeXmlEntities(key),
          size: Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0),
          lastModified: new Date(block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? 0),
        });
      }

      continuationToken =
        xml.match(/<IsTruncated>true<\/IsTruncated>/) != null
          ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
          : undefined;
    } while (continuationToken);

    return objects;
  }
}

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

/** Exported for unit tests — deterministic signing against a known vector. */
export const __testing = { signRequest, canonicalUri, canonicalQuery };
