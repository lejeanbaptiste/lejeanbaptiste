#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

function parseArgs(argv) {
  const options = {
    suite: 'stable',
    component: 'main',
    origin: 'Grognard',
    label: 'Grognard',
    codename: 'stable',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return value;
    };

    switch (arg) {
      case '--input':
        options.input = next();
        break;
      case '--output':
        options.output = next();
        break;
      case '--suite':
        options.suite = next();
        break;
      case '--component':
        options.component = next();
        break;
      case '--origin':
        options.origin = next();
        break;
      case '--label':
        options.label = next();
        break;
      case '--codename':
        options.codename = next();
        break;
      case '--description':
        options.description = next();
        break;
      case '--gpg-key':
        options.gpgKey = next();
        break;
      case '--gpg-home':
        options.gpgHome = next();
        break;
      case '--export-public-key':
        options.exportPublicKey = next();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.input) throw new Error('Missing required --input directory');
  if (!options.output) throw new Error('Missing required --output directory');

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [command, ...args].join(' ') +
        ` failed${stderr ? `:\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
    );
  }

  return result.stdout ?? '';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const repoDir = outputDir;
  const poolDir = path.join(repoDir, 'pool', 'main', 'l', 'grognard-desktop');
  const distDir = path.join(repoDir, 'dists', options.suite);
  const releaseDir = path.join(distDir, options.component);

  await fs.access(inputDir);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(poolDir, { recursive: true });

  const debFiles = (await fs.readdir(inputDir)).filter((file) => file.endsWith('.deb')).sort();
  if (debFiles.length === 0) {
    throw new Error(`No .deb files found in ${inputDir}`);
  }

  const architectures = new Set();
  const packageNamesByArchitecture = new Map();
  const debFilesByArchitecture = new Map();
  for (const debFile of debFiles) {
    const sourcePath = path.join(inputDir, debFile);
    const architecture = run('dpkg-deb', ['-f', sourcePath, 'Architecture']).trim();
    const packageName = run('dpkg-deb', ['-f', sourcePath, 'Package']).trim();
    architectures.add(architecture);
    if (!packageNamesByArchitecture.has(architecture)) {
      packageNamesByArchitecture.set(architecture, new Set());
    }
    packageNamesByArchitecture.get(architecture).add(packageName);
    if (!debFilesByArchitecture.has(architecture)) {
      debFilesByArchitecture.set(architecture, []);
    }
    debFilesByArchitecture.get(architecture).push(debFile);
    await fs.copyFile(sourcePath, path.join(poolDir, debFile));
  }

  const scanRoot = path.join(repoDir, '.scan');
  const poolPathRelative = path.relative(repoDir, poolDir);
  for (const architecture of architectures) {
    const architectureDir = path.join(releaseDir, `binary-${architecture}`);
    await fs.mkdir(architectureDir, { recursive: true });
    const packagesPath = path.join(architectureDir, 'Packages');
    // Scan a directory containing ONLY this architecture's .deb files -
    // never the shared multi-arch pool - even though the pool is where the
    // files are actually published from (see the Filename rewrite below).
    // Our amd64 and arm64 builds share the exact same Package name and
    // Version (only Architecture differs), and dpkg-scanpackages' "two
    // packages with the same name+version but no --multiversion" collision
    // guard doesn't reliably key on architecture too - depending on the
    // dpkg-scanpackages version on the runner, scanning the shared pool with
    // `-a <arch>` silently produced an EMPTY Packages file for one or both
    // architectures (confirmed live: the previously "successful" apt-repo
    // publish deployed 0-byte Packages for amd64 and arm64 both, which is
    // why `apt install` had nothing to find). Physically isolating each
    // architecture's .deb(s) before scanning makes the collision structurally
    // impossible, independent of dpkg-scanpackages' exact version behavior.
    const scanDir = path.join(scanRoot, architecture);
    await fs.mkdir(scanDir, { recursive: true });
    for (const debFile of debFilesByArchitecture.get(architecture) ?? []) {
      await fs.link(path.join(poolDir, debFile), path.join(scanDir, debFile));
    }
    const scanPathRelative = path.relative(repoDir, scanDir);
    let packages = run('dpkg-scanpackages', [scanPathRelative, '/dev/null'], {
      cwd: repoDir,
    });
    // dpkg-scanpackages records Filename as <path-we-gave-it>/<debFile>; point
    // it back at the real published pool location, not the scratch scan dir
    // (which gets deleted below, before this ever reaches GitHub Pages).
    packages = packages
      .split(`Filename: ${scanPathRelative}/`)
      .join(`Filename: ${poolPathRelative}/`);
    for (const packageName of packageNamesByArchitecture.get(architecture) ?? []) {
      if (!packages.split(/\r?\n/).includes(`Package: ${packageName}`)) {
        throw new Error(`APT index for ${architecture} is missing ${packageName}`);
      }
    }
    await fs.writeFile(packagesPath, packages);
    await fs.writeFile(`${packagesPath}.gz`, zlib.gzipSync(Buffer.from(packages), { mtime: 0 }));
  }
  await fs.rm(scanRoot, { recursive: true, force: true });

  const aptFtpArchiveConfig = path.join(repoDir, 'apt-ftparchive.conf');
  await fs.writeFile(
    aptFtpArchiveConfig,
    [
      'APT::FTPArchive::Release {',
      `  Origin "${options.origin}";`,
      `  Label "${options.label}";`,
      `  Suite "${options.suite}";`,
      `  Codename "${options.codename}";`,
      `  Components "${options.component}";`,
      `  Architectures "${Array.from(architectures).sort().join(' ')}";`,
      options.description ? `  Description "${options.description}";` : '',
      '};',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  const releaseOutput = run('apt-ftparchive', ['-c', aptFtpArchiveConfig, 'release', distDir], {
    cwd: repoDir,
  });
  const releasePath = path.join(distDir, 'Release');
  await fs.writeFile(releasePath, releaseOutput);
  await fs.unlink(aptFtpArchiveConfig);

  if (options.gpgKey) {
    const gpgBaseArgs = ['--batch', '--yes', '--pinentry-mode', 'loopback'];
    if (options.gpgHome) {
      gpgBaseArgs.push('--homedir', options.gpgHome);
    }
    if (process.env.APT_GPG_PASSPHRASE) {
      gpgBaseArgs.push('--passphrase', process.env.APT_GPG_PASSPHRASE);
    }

    await fs.writeFile(
      path.join(distDir, 'InRelease'),
      run(
        'gpg',
        [
          ...gpgBaseArgs,
          '--local-user',
          options.gpgKey,
          '--clearsign',
          '--output',
          '-',
          releasePath,
        ],
        { cwd: repoDir },
      ),
    );

    await fs.writeFile(
      path.join(distDir, 'Release.gpg'),
      run(
        'gpg',
        [
          ...gpgBaseArgs,
          '--local-user',
          options.gpgKey,
          '--armor',
          '--detach-sign',
          '--output',
          '-',
          releasePath,
        ],
        { cwd: repoDir },
      ),
    );

    if (options.exportPublicKey) {
      const publicKey = run(
        'gpg',
        [
          '--batch',
          '--yes',
          ...(options.gpgHome ? ['--homedir', options.gpgHome] : []),
          '--armor',
          '--export',
          options.gpgKey,
        ],
        { cwd: repoDir },
      );
      await fs.writeFile(options.exportPublicKey, publicKey);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
