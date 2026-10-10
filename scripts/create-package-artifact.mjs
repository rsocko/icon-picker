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
import {
  artifactSummary,
  createCanonicalPackageTree,
  npmPack,
  readArtifactContract,
  validateArtifactContract,
  validatePackageManifest,
} from './package-lib.mjs';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const artifactContract = readArtifactContract();
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
const canonical = createCanonicalPackageTree();

try {
  const first = npmPack(firstDirectory, canonical.stagingDirectory);
  const second = npmPack(secondDirectory, canonical.stagingDirectory);
  validatePackageManifest(first.manifest, packageJson);
  validatePackageManifest(second.manifest, packageJson);

  const summary = artifactSummary(first.manifest, first.artifactPath);
  const secondSummary = artifactSummary(second.manifest, second.artifactPath);
  if (summary.sha512 !== secondSummary.sha512) {
    throw new Error('Repeated npm pack runs produced different tarball bytes.');
  }
  validateArtifactContract(summary, artifactContract);

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
      sha256: summary.sha256,
      sha512: summary.sha512,
      files: first.manifest.files.map((file) => file.path).sort(),
    },
    acquisition: 'canonical-npm-pack-from-source',
    canonicalization: {
      lineEndings: 'lf',
      artifactContract: 'package-artifact.json',
    },
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
  canonical.cleanup();
  rmSync(firstDirectory, { recursive: true, force: true });
  rmSync(secondDirectory, { recursive: true, force: true });
}
