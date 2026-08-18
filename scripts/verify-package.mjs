import { execFileSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Run package verification through npm run package:verify.');
}

const output = execFileSync(
  process.execPath,
  [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
  { encoding: 'utf8' },
);
const [manifest] = JSON.parse(output);

if (!manifest?.files) {
  throw new Error('npm pack did not return a package manifest.');
}

const packagedFiles = new Set(manifest.files.map((file) => file.path));
const requiredFiles = [
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
const missingFiles = requiredFiles.filter((file) => !packagedFiles.has(file));

if (missingFiles.length > 0) {
  throw new Error(`Package is missing required files: ${missingFiles.join(', ')}`);
}

if (manifest.name !== '@rsocko/icon-picker' || manifest.version !== '0.1.0-rc.0') {
  throw new Error(`Unexpected package identity: ${manifest.name}@${manifest.version}`);
}

console.log(
  `Verified ${manifest.name}@${manifest.version}: ${manifest.entryCount} files, ${manifest.size} bytes packed.`,
);
