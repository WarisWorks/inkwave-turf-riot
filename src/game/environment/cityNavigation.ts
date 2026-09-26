import { CollisionIndex } from "./collision";
import type { CollisionBox } from "./environmentTypes";

export type NavPoint = { x: number; y: number; z: number };
type Node = NavPoint & { links: number[] };
type Pool = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Small layered surface graph built once from the authored boxes, including underpasses. */
export class CityNavigation {
  readonly nodes: Node[] = [];
  private cells = new Map<string, number[]>();
  private index = new CollisionIndex();

  constructor(boxes: CollisionBox[], private pools: Pool[], entry?: NavPoint) {
    this.index.rebuild(boxes);
    for (let x = -28.5; x <= 28.5; x++) for (let z = -36.5; z <= 36.5; z++) {
      const ids: number[] = [];
      for (const y of this.heights(x, z)) {
        ids.push(this.nodes.length);
        this.nodes.push({ x, y, z, links: [] });
      }
      this.cells.set(`${x}:${z}`, ids);
    }
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const id of this.cells.get(`${node.x + dx}:${node.z + dz}`) ?? []) {
          const next = this.nodes[id];
          if (next.y - node.y > 1.01 || node.y - next.y > 1.25) continue;
          if (this.canWalk(node, next)) node.links.push(id);
        }
      }
    }
    // Closed landmark roofs must not become patrol destinations. Other arenas
    // retain all layers; Urumqi supplies an entry on its connected street network.
    if (entry) {
      const start = this.nearest(entry);
      if (start >= 0) {
        const reached = new Set([start]), queue = [start];
        for (let i = 0; i < queue.length; i++) for (const next of this.nodes[queue[i]].links) {
          if (!reached.has(next)) { reached.add(next); queue.push(next); }
        }
        const kept = this.nodes.filter((_, i) => reached.has(i));
        const ids = new Map<number, number>();
        let nextId = 0;
        this.nodes.forEach((_, i) => { if (reached.has(i)) ids.set(i, nextId++); });
        kept.forEach((node) => { node.links = node.links.filter(id => reached.has(id)).map(id => ids.get(id)!); });
        this.nodes.splice(0, this.nodes.length, ...kept);
      }
    }
    this.cells.clear();
  }

  private heights(x: number, z: number) {
    const near = this.index.at(x, z);
    const heights = new Set([0]);
    for (const b of near) if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) heights.add(b.maxY);
    return [...heights].filter((y) => {
      if (y < 0.4 && this.pools.some((p) => x > p.minX - 0.45 && x < p.maxX + 0.45 && z > p.minZ - 0.45 && z < p.maxZ + 0.45)) return false;
      return !near.some((b) => y + 1.5 > b.minY + 0.03 && y < b.maxY - 0.5 && x > b.minX - 0.4 && x < b.maxX + 0.4 && z > b.minZ - 0.4 && z < b.maxZ + 0.4);
    });
  }

  canWalk(from: NavPoint, to: NavPoint) {
    let y = from.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.2));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const choices = this.heights(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t).filter((h) => h <= y + 0.5 + 1e-6 && h >= y - 1.25);
      if (!choices.length) return false;
      y = Math.max(...choices);
    }
    return Math.abs(y - to.y) < 0.51;
  }

  nearest(point: NavPoint) {
    let nearest = -1;
    let best = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodes[i];
      const cost = (p.x - point.x) ** 2 + (p.z - point.z) ** 2 + ((p.y - point.y) * 3) ** 2;
      if (cost < best) { best = cost; nearest = i; }
    }
    return nearest;
  }

  path(from: NavPoint, to: NavPoint): NavPoint[] {
    const start = this.nearest(from), goal = this.nearest(to);
    if (start < 0 || goal < 0) return [];
    const scores = new Float64Array(this.nodes.length).fill(Infinity);
    const parent = new Int32Array(this.nodes.length).fill(-1);
    const visited = new Uint8Array(this.nodes.length);
    const heap: { id: number; score: number }[] = [];
    const heuristic = (id: number) => { const p = this.nodes[id], q = this.nodes[goal]; return Math.abs(p.x - q.x) + Math.abs(p.z - q.z); };
    const push = (id: number, score: number) => {
      let i = heap.length; heap.push({ id, score });
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p].score <= score) break; heap[i] = heap[p]; i = p; }
      heap[i] = { id, score };
    };
    const pop = () => {
      const first = heap[0], last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
          if (last.score <= heap[child].score) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = last;
      }
      return first.id;
    };
    scores[start] = 0; push(start, heuristic(start));
    while (heap.length) {
      const id = pop();
      if (visited[id]) continue;
      if (id === goal) {
        const path: NavPoint[] = [];
        for (let cursor = goal; cursor !== -1; cursor = parent[cursor]) path.push(this.nodes[cursor]);
        return path.reverse();
      }
      visited[id] = 1;
      for (const next of this.nodes[id].links) {
        const score = scores[id] + 1 + Math.abs(this.nodes[next].y - this.nodes[id].y) * 0.3;
        if (score >= scores[next]) continue;
        scores[next] = score; parent[next] = id; push(next, score + heuristic(next));
      }
    }
    return [];
  }
}
