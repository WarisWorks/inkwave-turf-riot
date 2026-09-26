import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
const functions = {};
function visit(n) { if (ts.isFunctionDeclaration(n) && ['updateProj', 'spawnProj'].includes(n.name?.text)) functions[n.name.text] = ts.transpileModule(n.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; ts.forEachChild(n, visit); }
visit(ast);
const shot = (extra = {}) => ({ alive: true, stuck: false, x: 0, y: 1, z: 0, vx: 120, vy: 0, vz: 0, grav: 0, life: 1, team: 1, owner: 0, dmg: 58, paintR: 1, hitR: 0.1, splash: 0, kind: 'shot', trail: 0, ...extra });
const target = (x) => ({ alive: true, team: 2, invuln: 0, x, y: 0, z: 0 });
function world(enemy, wall = null) {
  const hits = [], impacts = [];
  const ctx = vm.createContext({ actors: [{ alive: true, team: 1 }, enemy], projs: [], clamp: (v,a,b) => Math.max(a,Math.min(b,v)), castWorld: () => wall, hurt: (actor,dmg) => hits.push({actor,dmg}), paint(){}, burst(){}, spark(){}, splashAt(){}, impactProj: (...args) => impacts.push(args) });
  vm.runInContext(functions.updateProj + '\n' + functions.spawnProj, ctx);
  return { ctx, hits, impacts };
}

test('a fast round hits actors between its previous and current positions', () => {
  const {ctx,hits} = world(target(1)); const p=shot(); ctx.updateProj(p,1/60);
  assert.equal(hits.length,1); assert.equal(hits[0].dmg,58); assert.equal(p.alive,false);
});
test('world collision occludes an actor behind cover in the same projectile step', () => {
  const {ctx,hits,impacts} = world(target(1),{dist:0.4,x:0.4,y:1,z:0,nx:-1,ny:0,nz:0}); ctx.updateProj(shot(),1/60);
  assert.equal(hits.length,0); assert.equal(impacts.length,1);
});
test('an actor in front of a wall is still hittable', () => {
  const {ctx,hits} = world(target(0.5),{dist:1.7,x:1.7,y:1,z:0,nx:-1,ny:0,nz:0}); ctx.updateProj(shot(),1/60);
  assert.equal(hits.length,1);
});
test('overlapping bucket drops apply direct damage once per volley, with a fresh next volley', () => {
  const {ctx,hits} = world(target(1)); const hitActors=new Set();
  for(let i=0;i<5;i++) ctx.updateProj(shot({hitActors}),1/60);
  assert.equal(hits.length,1);
  ctx.updateProj(shot({hitActors:new Set()}),1/60); assert.equal(hits.length,2);
});
test('projectile pool reuse clears the previous bucket volley hit set', () => {
  const {ctx} = world(target(1)); const pooled=shot({alive:false,hitActors:new Set([1])});ctx.projs.push(pooled);
  const next=shot();delete next.alive;delete next.stuck;
  ctx.spawnProj(next);assert.equal(pooled.hitActors,undefined);assert.equal(pooled.alive,true);
});
