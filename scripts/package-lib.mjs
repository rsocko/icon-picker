import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const requiredPackageFiles = [
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/core.js',
  'dist/core.d.ts',
  'dist/renderer.js',
  'dist/renderer.d.ts',
  'dist/picker.js',
  'dist/picker.d.ts',
  'dist/styles.css',
  'package.json',
];

const forbiddenPrefixes = ['demo/', 'demo-dist/', '.github/', 'scripts/', 'tests/'];

export function npmPack(destination) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('Run package operations through an npm script.');
  }

  const output = execFileSync(
    process.execPath,
    [
      npmCli,
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      destination,
    ],
    { encoding: 'utf8' },
  );
  const [manifest] = JSON.parse(output);
  if (!manifest?.files || !manifest.filename) {
    throw new Error('npm pack did not return a complete package manifest.');
  }
  return {
    manifest,
    artifactPath: join(destination, manifest.filename),
  };
}

export function validatePackageManifest(manifest, packageJson) {
  const packagedFiles = new Set(manifest.files.map((file) => file.path));
  const missingFiles = requiredPackageFiles.filter((file) => !packagedFiles.has(file));
  const forbiddenFiles = [...packagedFiles].filter((file) =>
    forbiddenPrefixes.some((prefix) => file.startsWith(prefix)),
  );

  if (missingFiles.length > 0) {
    throw new Error(`Package is missing required files: ${missingFiles.join(', ')}`);
  }
  if (forbiddenFiles.length > 0) {
    throw new Error(`Package includes non-runtime files: ${forbiddenFiles.join(', ')}`);
  }
  if (manifest.name !== packageJson.name || manifest.version !== packageJson.version) {
    throw new Error(`Unexpected package identity: ${manifest.name}@${manifest.version}`);
  }
}

export function hashFile(path, algorithm) {
  return createHash(algorithm).update(readFileSync(path)).digest('hex');
}
