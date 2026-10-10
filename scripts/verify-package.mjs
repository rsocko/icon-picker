import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  artifactSummary,
  createCanonicalPackageTree,
  npmPack,
  readArtifactContract,
  validateArtifactContract,
  validatePackageManifest,
} from './package-lib.mjs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const contract = readArtifactContract();
const firstDirectory = mkdtempSync(join(tmpdir(), 'icon-picker-pack-a-'));
const secondDirectory = mkdtempSync(join(tmpdir(), 'icon-picker-pack-b-'));
const canonical = createCanonicalPackageTree();

try {
  const first = npmPack(firstDirectory, canonical.stagingDirectory);
  const second = npmPack(secondDirectory, canonical.stagingDirectory);
  validatePackageManifest(first.manifest, packageJson);
  validatePackageManifest(second.manifest, packageJson);

  const firstSummary = artifactSummary(first.manifest, first.artifactPath);
  const secondSummary = artifactSummary(second.manifest, second.artifactPath);
  if (firstSummary.sha512 !== secondSummary.sha512) {
    throw new Error('Repeated npm pack runs produced different tarball bytes.');
  }
  validateArtifactContract(firstSummary, contract);

  console.log(
    `Verified deterministic ${first.manifest.name}@${first.manifest.version}: ` +
      `${first.manifest.entryCount} files, ${first.manifest.size} bytes, ` +
      `sha512 ${firstSummary.sha512}.`,
  );
} finally {
  canonical.cleanup();
  rmSync(firstDirectory, { recursive: true, force: true });
  rmSync(secondDirectory, { recursive: true, force: true });
}
