import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the engine's real updateZone rules and constants without a WebGL renderer.
const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
const pieces = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'updateZone') pieces.push(node.getText(ast));
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => /^ZONE_(CAPTURE|LEAD|HOLD|RATE)$/.test(d.name.getText(ast)))) {
    pieces.push(node.getText(ast).replace(/^const /, 'var '));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(pieces.length, 5);
const code = ts.transpileModule(pieces.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function zone({ o = 0, v = 0, holder = 0, points = [0, 0] } = {}) {
  const log = { banners: [], ended: 0 };
  const ctx = vm.createContext({
    zoneShareO: o, zoneShareV: v, zoneHolder: holder, zoneKO: false,
    zonePts: { orange: points[0], violet: points[1] },
    setBanner(text) { log.banners.push(text); },
    pushFeed() {},
    audio: { chime() {}, thud() {}, blip() {} },
    endMatch() { log.ended++; },
  });
  vm.runInContext(code, ctx);
  const step = (dt = 1) => vm.runInContext(`updateZone(${dt})`, ctx);
  return { ctx, log, step };
}

test('a clear majority of the zone captures it and banks points', () => {
  const z = zone({ o: 0.56, v: 0.2 });
  z.step(3);
  assert.equal(z.ctx.zoneHolder, 1);
  assert.equal(z.log.banners[0], 'مەركەز بىزنىڭ!');
  assert.ok(Math.abs(z.ctx.zonePts.orange - 3 * z.ctx.ZONE_RATE) < 1e-9);
  assert.equal(z.ctx.zonePts.violet, 0);
});

test('a narrow lead does not capture a neutral zone', () => {
  const z = zone({ o: 0.52, v: 0.45 });
  z.step();
  assert.equal(z.ctx.zoneHolder, 0);
  assert.equal(z.ctx.zonePts.orange, 0);
});

test('the holder keeps the zone above the hold line and loses it below', () => {
  const z = zone({ o: 0.4, v: 0.3, holder: 1 });
  z.step();
  assert.equal(z.ctx.zoneHolder, 1);
  z.ctx.zoneShareO = 0.3;
  z.step();
  assert.equal(z.ctx.zoneHolder, 0);
  assert.equal(z.log.banners.at(-1), 'مەركەز قولدىن كەتتى');
});

test('the rival flips a held zone by capturing it', () => {
  const z = zone({ o: 0.3, v: 0.55, holder: 1 });
  z.step();
  assert.equal(z.ctx.zoneHolder, 2);
  assert.equal(z.log.banners[0], 'رەقىب مەركەزنى ئالدى!');
});

test('reaching 100 control points is a knockout', () => {
  const z = zone({ o: 0.1, v: 0.7, holder: 2, points: [40, 99.5] });
  z.step(1);
  assert.equal(z.ctx.zonePts.violet, 100);
  assert.equal(z.ctx.zoneKO, true);
  assert.equal(z.log.ended, 1);
});

test('holding the zone for a full minute is a knockout', () => {
  assert.ok(Math.abs(zone().ctx.ZONE_RATE * 60 - 100) < 1e-9);
});
