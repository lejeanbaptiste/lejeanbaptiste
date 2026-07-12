#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

function parseArgs(argv) {
  const options = {
    suite: 'stable',
    component: 'main',
    origin: 'Le Jean-Baptiste',
    label: 'Le Jean-Baptiste',
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
      [command, ...args].join(' ') + ` failed${stderr ? `:\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
    );
  }

  return result.stdout ?? '';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const repoDir = outputDir;
  const poolDir = path.join(repoDir, 'pool', 'main', 'l', 'le-jean-baptiste-desktop');
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
  for (const debFile of debFiles) {
    const sourcePath = path.join(inputDir, debFile);
    const architecture = run('dpkg-deb', ['-f', sourcePath, 'Architecture']).trim();
    architectures.add(architecture);
    await fs.copyFile(sourcePath, path.join(poolDir, debFile));
  }

  for (const architecture of architectures) {
    const architectureDir = path.join(releaseDir, `binary-${architecture}`);
    await fs.mkdir(architectureDir, { recursive: true });
    const packagesPath = path.join(architectureDir, 'Packages');
    const packages = run('dpkg-scanpackages', ['-a', architecture, 'pool', '/dev/null'], {
      cwd: repoDir,
    });
    await fs.writeFile(packagesPath, packages);
    await fs.writeFile(
      `${packagesPath}.gz`,
      zlib.gzipSync(Buffer.from(packages), { mtime: 0 }),
    );
  }

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
        [...gpgBaseArgs, '--local-user', options.gpgKey, '--clearsign', '--output', '-', releasePath],
        { cwd: repoDir },
      ),
    );

    await fs.writeFile(
      path.join(distDir, 'Release.gpg'),
      run(
        'gpg',
        [...gpgBaseArgs, '--local-user', options.gpgKey, '--armor', '--detach-sign', '--output', '-', releasePath],
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
