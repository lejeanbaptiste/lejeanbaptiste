#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as tar from 'tar';

function parseArgs(argv) {
  const options = new Map();
  const lists = new Map();
  const positionals = [];

  const pushList = (key, value) => {
    if (!lists.has(key)) lists.set(key, []);
    lists.get(key).push(value);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('-')) {
      const next = argv[i + 1];
      switch (arg) {
        case '-s':
        case '-t':
        case '--architecture':
        case '--after-install':
        case '--after-remove':
        case '--description':
        case '--version':
        case '--package':
        case '--name':
        case '--maintainer':
        case '--vendor':
        case '--url':
        case '--category':
        case '--deb-priority':
        case '--license':
        case '--iteration':
        case '--log':
        case '--rpm-summary':
        case '--deb-install-cmd':
        case '--deb-remove-cmd':
          options.set(arg, next);
          i += 1;
          break;
        case '-d':
        case '--deb-recommends':
          pushList(arg, next);
          i += 1;
          break;
        default:
          // Flags like --force / --debug are accepted and ignored.
          break;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { options, lists, positionals };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyEntry(source, destination) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) {
    const linkTarget = await fs.readlink(source);
    await ensureDir(path.dirname(destination));
    try {
      await fs.symlink(linkTarget, destination);
    } catch (error) {
      if (error.code === 'EEXIST') {
        await fs.unlink(destination);
        await fs.symlink(linkTarget, destination);
        return;
      }
      throw error;
    }
    return;
  }

  if (stat.isDirectory()) {
    await ensureDir(destination);
    const entries = await fs.readdir(source);
    for (const entry of entries) {
      await copyEntry(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
  await fs.chmod(destination, stat.mode & 0o777);
}

async function stageMappings(positionals) {
  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fpm-stage-'));
  for (const mapping of positionals) {
    const eq = mapping.indexOf('=');
    if (eq <= 0) continue;
    const source = mapping.slice(0, eq);
    const destination = mapping.slice(eq + 1);
    if (!source || !destination) continue;
    const cleanSource = source.endsWith('/') ? source.slice(0, -1) : source;
    const stat = await fs.lstat(cleanSource);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(cleanSource);
      for (const entry of entries) {
        await copyEntry(path.join(cleanSource, entry), path.join(stageRoot, destination, entry));
      }
    } else {
      await copyEntry(cleanSource, path.join(stageRoot, destination));
    }
  }
  return stageRoot;
}

function formatControlField(name, value) {
  if (value == null || value === '') return '';
  return `${name}: ${String(value)}`;
}

function formatDescription(value) {
  const lines = String(value ?? '').split(/\r?\n/);
  const first = lines.shift() ?? '';
  const rest = lines.map((line) => ` ${line}`).join('\n');
  return `Description: ${first}${rest ? `\n${rest}` : ''}`;
}

async function makeTarGz(sourceDir, outFile) {
  await tar.c(
    {
      gzip: true,
      cwd: sourceDir,
      portable: true,
      noMtime: true,
      file: outFile,
    },
    ['.'],
  );
}

function arHeader(name, size, mode = 0o100644, mtime = Math.floor(Date.now() / 1000), uid = 0, gid = 0) {
  const pad = (value, length, alignLeft = false) => {
    const s = String(value);
    return alignLeft ? s.padEnd(length, ' ') : s.padStart(length, ' ');
  };
  const nameField = pad(`${name}/`, 16, true).slice(0, 16);
  const header =
    `${nameField}` +
    `${pad(mtime, 12)}` +
    `${pad(uid, 6)}` +
    `${pad(gid, 6)}` +
    `${pad(mode.toString(8), 8)}` +
    `${pad(size, 10)}` +
    '`\n';
  return Buffer.from(header, 'ascii');
}

async function writeArArchive(outFile, members) {
  const chunks = [Buffer.from('!<arch>\n', 'ascii')];
  for (const member of members) {
    const data = await fs.readFile(member.file);
    chunks.push(arHeader(member.name, data.length, member.mode ?? 0o100644));
    chunks.push(data);
    if (data.length % 2 === 1) chunks.push(Buffer.from('\n'));
  }
  await fs.writeFile(outFile, Buffer.concat(chunks));
}

async function main() {
  const { options, lists, positionals } = parseArgs(process.argv.slice(2));
  const target = options.get('-t');
  if (target !== 'deb') {
    throw new Error(`Unsupported target: ${target ?? '(missing)'}`);
  }

  const outFile = options.get('--package');
  if (!outFile) {
    throw new Error('Missing --package output path');
  }

  const appStage = await stageMappings(positionals);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fpm-deb-'));
  const controlDir = path.join(tempRoot, 'control');
  const dataDir = path.join(tempRoot, 'data');
  await ensureDir(controlDir);
  await ensureDir(dataDir);

  await copyEntry(appStage, dataDir);

  const afterInstall = options.get('--after-install');
  if (afterInstall) {
    await fs.copyFile(afterInstall, path.join(controlDir, 'postinst'));
    await fs.chmod(path.join(controlDir, 'postinst'), 0o755);
  }
  const afterRemove = options.get('--after-remove');
  if (afterRemove) {
    await fs.copyFile(afterRemove, path.join(controlDir, 'postrm'));
    await fs.chmod(path.join(controlDir, 'postrm'), 0o755);
  }

  const controlFields = [
    formatControlField('Package', options.get('--name')),
    formatControlField('Version', options.get('--version')),
    formatControlField('Section', options.get('--category') ?? 'misc'),
    formatControlField('Priority', options.get('--deb-priority') ?? 'optional'),
    formatControlField('Architecture', options.get('--architecture')),
    formatControlField('Maintainer', options.get('--maintainer')),
    options.get('--url') ? formatControlField('Homepage', options.get('--url')) : '',
    lists.get('-d')?.length ? formatControlField('Depends', lists.get('-d').join(', ')) : '',
    lists.get('--deb-recommends')?.length ? formatControlField('Recommends', lists.get('--deb-recommends').join(', ')) : '',
    formatDescription(options.get('--description')),
  ].filter(Boolean);

  await fs.writeFile(path.join(controlDir, 'control'), `${controlFields.join('\n')}\n`);

  const controlTar = path.join(tempRoot, 'control.tar.gz');
  const dataTar = path.join(tempRoot, 'data.tar.gz');
  await makeTarGz(controlDir, controlTar);
  await makeTarGz(dataDir, dataTar);

  await ensureDir(path.dirname(outFile));
  await fs.writeFile(path.join(tempRoot, 'debian-binary'), '2.0\n');
  await writeArArchive(outFile, [
    { name: 'debian-binary', file: path.join(tempRoot, 'debian-binary'), mode: 0o100644 },
    { name: 'control.tar.gz', file: controlTar, mode: 0o100644 },
    { name: 'data.tar.gz', file: dataTar, mode: 0o100644 },
  ]);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
