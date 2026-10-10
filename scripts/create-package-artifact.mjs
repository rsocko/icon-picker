import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { hashFile, npmPack, validatePackageManifest } from './package-lib.mjs';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const dirtyPaths = git('status', '--porcelain');
if (dirtyPaths) {
  throw new Error('Create downstream artifacts only from a clean exact commit.');
}

const headCommit = git('rev-parse', 'HEAD');
const sourceCommit = process.env.SOURCE_COMMIT || headCommit;
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error(`Invalid source commit: ${sourceCommit}`);
}
if (sourceCommit !== headCommit) {
  throw new Error(`SOURCE_COMMIT ${sourceCommit} does not match HEAD ${headCommit}.`);
}

let sourceTag = process.env.SOURCE_TAG || null;
if (!sourceTag) {
  const tags = git('tag', '--points-at', 'HEAD')
    .split(/\r?\n/)
    .filter(Boolean);
  sourceTag = tags.includes(`v${packageJson.version}`)
    ? `v${packageJson.version}`
    : (tags[0] ?? null);
}
if (sourceTag && sourceTag !== `v${packageJson.version}`) {
  throw new Error(
    `Source tag ${sourceTag} does not match package version v${packageJson.version}.`,
  );
}

const outputDirectory = resolve(process.argv[2] ?? 'artifacts');
const firstDirectory = mkdtempSync(join(tmpdir(), 'icon-picker-artifact-a-'));
const secondDirectory = mkdtempSync(join(tmpdir(), 'icon-picker-artifact-b-'));

try {
  const first = npmPack(firstDirectory);
  const second = npmPack(secondDirectory);
  validatePackageManifest(first.manifest, packageJson);
  validatePackageManifest(second.manifest, packageJson);

  const sha512 = hashFile(first.artifactPath, 'sha512');
  if (sha512 !== hashFile(second.artifactPath, 'sha512')) {
    throw new Error('Repeated npm pack runs produced different tarball bytes.');
  }

  mkdirSync(outputDirectory, { recursive: true });
  const artifactPath = join(outputDirectory, first.manifest.filename);
  copyFileSync(first.artifactPath, artifactPath);
  const provenance = {
    schemaVersion: 1,
    package: {
      name: first.manifest.name,
      version: first.manifest.version,
    },
    source: {
      repository: packageJson.repository.url,
      commit: sourceCommit,
      tag: sourceTag,
    },
    artifact: {
      filename: first.manifest.filename,
      size: first.manifest.size,
      unpackedSize: first.manifest.unpackedSize,
      entryCount: first.manifest.entryCount,
      integrity: first.manifest.integrity,
      shasum: first.manifest.shasum,
      sha256: hashFile(first.artifactPath, 'sha256'),
      sha512,
      files: first.manifest.files.map((file) => file.path).sort(),
    },
    acquisition: 'npm-pack-from-source',
  };
  writeFileSync(
    join(outputDirectory, 'UPSTREAM.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );
  console.log(
    `Created ${artifactPath} and ${join(outputDirectory, 'UPSTREAM.json')} ` +
      `from ${sourceCommit}.`,
  );
} finally {
  rmSync(firstDirectory, { recursive: true, force: true });
  rmSync(secondDirectory, { recursive: true, force: true });
}
