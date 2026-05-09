import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const required = [
  ['ADB', path.join(root, 'resources', 'bin', 'adb', 'adb.exe')],
  ['scrcpy', path.join(root, 'resources', 'bin', 'scrcpy', 'scrcpy.exe')],
  ['scrcpy server', path.join(root, 'resources', 'bin', 'scrcpy', 'scrcpy-server')]
];

const missing = required.filter(([, file]) => !fs.existsSync(file));
if (missing.length > 0) {
  console.error('Required free binaries are missing:');
  for (const [name, file] of missing) console.error(`- ${name}: ${file}`);
  console.error('\nDownload Android platform-tools and the official scrcpy Windows release, then copy the files into resources/bin before packaging.');
  process.exit(1);
}

console.log('ADB and scrcpy binaries are ready for packaging.');
