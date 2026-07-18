// jest-environment-jsdom's global scope doesn't include TextEncoder/TextDecoder (real
// browsers and Electron always have them), which the `docx` package needs to serialize
// generated files. Node provides both natively via `node:util`.
import { TextDecoder, TextEncoder } from 'node:util';

if (typeof globalThis.TextEncoder !== 'function') {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder !== 'function') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
