import crypto from 'crypto';
import { enableFetchMocks } from 'jest-fetch-mock';
import { TextDecoder, TextEncoder } from 'util';

enableFetchMocks();

Object.assign(global, { TextDecoder, TextEncoder });

Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: {
      digest: (algorithm: string, data: Uint8Array) => {
        return new Promise((resolve, reject) =>
          resolve(crypto.createHash(algorithm).update(data).digest())
        );
      },
    },
  },
});
