// 倉庫番ソルバー: 盤を通路と部屋に分け、部屋ごとに押し単位の幅優先探索で押し回数最適の解を求める。
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const solve = (level: string): string => {
  const rows = level.split('\n').filter(r => r.length);
  const W = Math.max(...rows.map(r => r.length));
  const g = rows.map(r => r.padEnd(W, '#')).join('');
  const D = [-W, W, -1, 1], L = 'udlr';
  let p = g.search(/[@+]/);
  const hall = (i: number) => Math.floor(i / W) === Math.floor(p / W);
  const floor = (i: number) => i >= 0 && i < g.length && g[i] != '#';
  const goals = new Set<number>(), boxes0 = new Set<number>();
  for (let i = 0; i < g.length; i++) {
    if ('.*+'.includes(g[i])) goals.add(i);
    if ('$*'.includes(g[i])) boxes0.add(i);
  }
  // 部屋 = 通路以外の床の連結成分。玄関 = 部屋に接する通路のマス。
  const seen = new Set<number>(), rooms: { cells: Set<number>; porch: number }[] = [];
  for (let s = 0; s < g.length; s++) {
    if (!floor(s) || hall(s) || seen.has(s)) continue;
    const cells = new Set([s]); seen.add(s);
    let porch = -1;
    for (const c of cells) for (const d of D) {
      const n = c + d;
      if (!floor(n)) continue;
      if (hall(n)) porch = n;
      else if (!seen.has(n)) { seen.add(n); cells.add(n); }
    }
    if ([...cells].some(c => boxes0.has(c))) rooms.push({ cells, porch });
  }
  // 箱 bs を避けて a から到達できるマス(親付き)。ok は人が立てるマス。
  const reach = (a: number, ok: (i: number) => boolean, bs: Set<number>) => {
    const par = new Map([[a, -1]]);
    for (const c of par.keys()) for (const d of D) {
      const n = c + d;
      if (ok(n) && !bs.has(n) && !par.has(n)) par.set(n, c);
    }
    return par;
  };
  const walk = (par: Map<number, number>, to: number) => {
    let s = '';
    for (let c = to; par.get(c)! >= 0; c = par.get(c)!) s = L[D.indexOf(c - par.get(c)!)] + s;
    return s;
  };
  // 部屋を解く: 状態 = (箱の並び, 人の到達域の最小マス)。戻り値は押しの列 [箱の位置, 方向]。
  const solveRoom = ({ cells, porch }: { cells: Set<number>; porch: number }, exit: boolean) => {
    const ok = (i: number) => cells.has(i) || i == porch;
    const start = [...cells].filter(c => boxes0.has(c)).sort((a, b) => a - b);
    const key = (bs: number[], pl: number) => bs + '|' + Math.min(...reach(pl, ok, new Set(bs)).keys());
    const prev = new Map<string, [string, number, number] | null>([[key(start, porch), null]]);
    const q: [number[], number, string][] = [[start, porch, key(start, porch)]];
    for (const [bs, pl, k] of q) {
      const set = new Set(bs), r = reach(pl, ok, set);
      if (bs.every(b => goals.has(b)) && (!exit || r.has(porch))) {
        const pushes: [number, number][] = [];
        for (let x = k; prev.get(x); x = prev.get(x)![0]) pushes.unshift([prev.get(x)![1], prev.get(x)![2]]);
        return pushes;
      }
      for (const b of bs) for (const d of D) {
        const t = b + d;
        if (!r.has(b - d) || !cells.has(t) || set.has(t)) continue;
        const nb = bs.map(x => (x == b ? t : x)).sort((a, c) => a - c), nk = key(nb, b);
        if (prev.has(nk)) continue;
        prev.set(nk, [k, b, d]);
        q.push([nb, b, nk]);
      }
    }
    return null;
  };
  // 玄関へ戻れる最適解がない部屋は最後に回し、そこだけ戻らない解を使う。
  const plans = rooms.map(rm => ({ rm, pushes: solveRoom(rm, true) }));
  plans.sort((a, b) => +!a.pushes - +!b.pushes);
  const last = plans[plans.length - 1];
  if (!last.pushes) last.pushes = solveRoom(last.rm, false);
  // 動きをつなげる
  const bs = new Set(boxes0);
  let out = '';
  for (const { rm, pushes } of plans) {
    out += walk(reach(p, floor, bs), rm.porch); p = rm.porch;
    for (const [b, d] of pushes!) {
      out += walk(reach(p, floor, bs), b - d) + L[D.indexOf(d)].toUpperCase();
      bs.delete(b); bs.add(b + d); p = b;
    }
  }
  return out;
};

for (const id of readdirSync(I).sort()) {
  const moves = solve(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
