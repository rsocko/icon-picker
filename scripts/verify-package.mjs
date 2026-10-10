import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashFile, npmPack, validatePackageManifest } from './package-lib.mjs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const firstDirectory = mkdtempSync(join(tmpdir(), 'icon-picker-pack-a-'));
const secondDirectory = mkdtempSync(join(tmpdir(), 'icon-picker-pack-b-'));

try {
  const first = npmPack(firstDirectory);
  const second = npmPack(secondDirectory);
  validatePackageManifest(first.manifest, packageJson);
  validatePackageManifest(second.manifest, packageJson);

  const firstHash = hashFile(first.artifactPath, 'sha512');
  const secondHash = hashFile(second.artifactPath, 'sha512');
  if (firstHash !== secondHash) {
    throw new Error('Repeated npm pack runs produced different tarball bytes.');
  }

  console.log(
    `Verified deterministic ${first.manifest.name}@${first.manifest.version}: ` +
      `${first.manifest.entryCount} files, ${first.manifest.size} bytes, sha512 ${firstHash}.`,
  );
} finally {
  rmSync(firstDirectory, { recursive: true, force: true });
  rmSync(secondDirectory, { recursive: true, force: true });
}
