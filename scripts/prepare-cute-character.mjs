// Usage: node scripts/prepare-cute-character.mjs /path/to/cute-character.glb
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareModel } from './prepare-model.mjs';

const folder = new URL('../public/models/characters/', import.meta.url);
const source = process.argv[2];
if (!source) throw new Error('Pass an external source GLB path: node scripts/prepare-cute-character.mjs /path/to/cute-character.glb');
const report = await prepareModel(source, fileURLToPath(new URL('cute.glb', folder)), 'Supplied Uyghur cute', 20000, false, {
  preserveTextureSeams: true,
  smoothNormals: true,
});
const manifest = new URL('manifest.json', folder);
const reports = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : [];
const next = { id: 'cute', ...report };
const index = reports.findIndex(item => item.id === 'cute');
if (index < 0) reports.push(next); else reports[index] = next;
writeFileSync(manifest, JSON.stringify(reports, null, 2) + '\n');
console.log(next);
