#!/usr/bin/env node
/**
 * Chrome native-messaging host: stdin JSON → POST to LJB browser-bridge.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pointerCandidates = () => [
  path.join(os.homedir(), '.config', 'lejeanbaptiste', 'browser-bridge.json'),
  path.join(os.homedir(), '.config', 'le-jean-baptiste', 'browser-bridge.json'),
];

const readBridge = () => {
  for (const file of pointerCandidates()) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch {
      // try next
    }
  }
  return null;
};

const readNativeMessage = async () => {
  const header = await readExact(4);
  if (!header) return null;
  const length = header.readUInt32LE(0);
  const body = await readExact(length);
  if (!body) return null;
  return JSON.parse(body.toString('utf8'));
};

const readExact = (size) =>
  new Promise((resolve) => {
    const chunks = [];
    let got = 0;
    const onReadable = () => {
      while (got < size) {
        const chunk = process.stdin.read(size - got);
        if (!chunk) return;
        chunks.push(chunk);
        got += chunk.length;
      }
      process.stdin.off('readable', onReadable);
      resolve(Buffer.concat(chunks));
    };
    process.stdin.on('readable', onReadable);
    process.stdin.on('end', () => {
      process.stdin.off('readable', onReadable);
      resolve(null);
    });
  });

const writeNativeMessage = (payload) => {
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
};

const main = async () => {
  const message = await readNativeMessage();
  if (!message) {
    writeNativeMessage({ error: 'EMPTY_MESSAGE' });
    return;
  }
  const bridge = readBridge();
  if (!bridge?.port || !bridge?.token) {
    writeNativeMessage({ error: 'LJB_NOT_RUNNING' });
    return;
  }
  try {
    process.kill(bridge.pid, 0);
  } catch {
    writeNativeMessage({ error: 'LJB_NOT_RUNNING' });
    return;
  }
  try {
    const response = await fetch(`http://127.0.0.1:${bridge.port}/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bridge.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    const body = await response.json();
    writeNativeMessage(body);
  } catch {
    writeNativeMessage({ error: 'LJB_NOT_RUNNING' });
  }
};

void main();
