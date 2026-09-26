// Usage: node scripts/prepare-character-models.mjs /path/to/original/model/folder
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareModel } from './prepare-model.mjs';
import { shortenBoyHair } from './shorten-boy-hair.mjs';
const sourceFolder = process.argv[2];
if (!sourceFolder) throw new Error('Pass the folder containing the original supplied character GLBs.');
const runtime = new URL('../public/models/characters/', import.meta.url);
const manifest = new URL('manifest.json', runtime);
const reports = new Map((existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : []).map(report => [report.id, report]));
for (const [source, id] of [
  ['3d cartoon boy model.glb', 'boy'],
  ['animated+boy+character+3d+model.glb', 'athlete'],
  ['girl character 3d model.glb', 'girl'],
  ['traditional dress character 3d model (1).glb', 'dress'],
]) {
  const report = await prepareModel(join(sourceFolder, source), fileURLToPath(new URL(`${id}.glb`, runtime)), `Supplied Uyghur ${id}`, 14000);
  if (id === 'boy') Object.assign(report, await shortenBoyHair(fileURLToPath(new URL('boy.glb', runtime))));
  reports.set(id, { id, ...report }); console.log(`${id}: ${report.runtimeBytes} bytes, ${report.runtimeTriangles} triangles`);
}
writeFileSync(manifest, JSON.stringify([...reports.values()], null, 2) + '\n');
