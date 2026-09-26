// Usage: node scripts/prepare-turpan-minaret.mjs /path/to/original.glb
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareModel } from './prepare-model.mjs';
const source = process.argv[2];
if (!source) throw new Error('Pass the original historic minaret GLB path.');
const folder = new URL('../public/models/turpan/', import.meta.url);
const report = await prepareModel(source, fileURLToPath(new URL('historic-minaret.glb', folder)), 'Historic minaret — Turpan');
writeFileSync(new URL('manifest.json', folder), JSON.stringify(report, null, 2) + '\n');
console.log(report);
