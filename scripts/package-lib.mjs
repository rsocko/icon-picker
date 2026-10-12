import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export const requiredPackageFiles = [
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/core.js',
  'dist/core.d.ts',
  'dist/export.js',
  'dist/export.d.ts',
  'dist/renderer.js',
  'dist/renderer.d.ts',
  'dist/picker.js',
  'dist/picker.d.ts',
  'dist/styles.css',
  'package.json',
];

const forbiddenPrefixes = ['demo/', 'demo-dist/', '.github/', 'scripts/', 'tests/'];
const packageRoots = [
  'dist',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'package.json',
];

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

export function createCanonicalPackageTree(sourceDirectory = process.cwd()) {
  const stagingParent = mkdtempSync(join(tmpdir(), 'icon-picker-package-'));
  const stagingDirectory = join(stagingParent, 'package');
  mkdirSync(stagingDirectory);

  for (const root of packageRoots) {
    cpSync(join(sourceDirectory, root), join(stagingDirectory, basename(root)), {
      recursive: true,
    });
  }

  for (const path of walkFiles(stagingDirectory)) {
    const content = readFileSync(path);
    if (content.includes(0)) {
      throw new Error(`Publishable package file is not text: ${path}`);
    }
    writeFileSync(path, content.toString('utf8').replace(/\r\n?|\n/g, '\n'));
  }

  return {
    stagingDirectory,
    cleanup: () => rmSync(stagingParent, { recursive: true, force: true }),
  };
}

export function npmPack(destination, sourceDirectory = process.cwd()) {
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
    { cwd: sourceDirectory, encoding: 'utf8' },
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

export function readArtifactContract(path = 'package-artifact.json') {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function artifactSummary(manifest, artifactPath) {
  return {
    name: manifest.name,
    version: manifest.version,
    filename: manifest.filename,
    size: manifest.size,
    unpackedSize: manifest.unpackedSize,
    entryCount: manifest.entryCount,
    integrity: manifest.integrity,
    shasum: manifest.shasum,
    sha256: hashFile(artifactPath, 'sha256'),
    sha512: hashFile(artifactPath, 'sha512'),
  };
}

export function validateArtifactContract(summary, contract) {
  for (const [key, expected] of Object.entries(contract)) {
    if (summary[key] !== expected) {
      throw new Error(
        `Artifact contract mismatch for ${key}: expected ${expected}, received ${summary[key]}.`,
      );
    }
  }
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
