// Usage: node scripts/prepare-urumqi-models.mjs /path/to/original-urumqi-models
// Requires Python/Pillow and installed Three.js.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareModel } from './prepare-model.mjs';
const sourceFolder = process.argv[2];
if (!sourceFolder) throw new Error('Pass the external folder containing the five original urumqi-1.glb through urumqi-5.glb files.');
const folder = new URL('../public/models/urumqi/', import.meta.url);
const reports = [];
for (let i = 1; i <= 5; i++) {
  const report = await prepareModel(join(sourceFolder, `urumqi-${i}.glb`), fileURLToPath(new URL(`runtime/urumqi-${i}.glb`, folder)), `Urumqi architecture ${i}`, i === 3 ? 28000 : 16000, i === 3);
  reports.push(report);
  console.log(report);
}
writeFileSync(new URL('runtime/manifest.json', folder), JSON.stringify(reports, null, 2) + '\n');
