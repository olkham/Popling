#!/usr/bin/env node
// Checks Popling's rounds using the game's own physics code, pulled out of index.html.
//
//   node tools/check-levels.js              check the 40 hand-built rounds
//   node tools/check-levels.js 3 17         check only rounds 3 and 17
//   node tools/check-levels.js --generated  check the generated rounds (41-99)
//   node tools/check-levels.js --show       print every map, not just the ones with problems
//
// For each round it walks every reachable standing spot from the two spawn points, trying
// full jumps with all sorts of air steering, and reports:
//   - a spawn point that is blocked or has no floor under it
//   - enemies that start inside bricks, in mid-air, or somewhere the player can't stand
//   - any moment where the player's body ends up inside a wall
//   - landable surfaces the player can never reach (marked ! in the map)
// In the printed map, H is a wall (a vertical run of 3+ bricks) and # is a platform.
// Exits with status 1 if any round has a problem, so it can run in CI.
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = (from, to) => {
  const i = src.indexOf(from);
  const j = src.indexOf(to, i);
  if (i < 0 || j < 0) throw new Error(`index.html no longer contains "${from}" … "${to}"`);
  return src.slice(i, j);
};
const code = grab('const W=256', 'const cvs=') +
  grab('// Hand-built rounds', 'function makeTileLayer') +
  grab('function landRow', 'const eBox');
const game = new Function('let grid;' + code +
  ';return {LV,genLevel,buildGrid,moveBody,setGrid:g=>{grid=g},W,PH,T,COLS,ROWS,JUMPV};')();
const { LV, genLevel, buildGrid, moveBody, setGrid, W, PH, T, COLS, ROWS, JUMPV } = game;

const args = process.argv.slice(2);
const show = args.includes('--show');
const generated = args.includes('--generated');
const only = args.filter(a => /^\d+$/.test(a)).map(Number);
const rounds = [];
if (generated) for (let n = LV.length + 1; n <= 99; n++) rounds.push([n, genLevel(n)]);
else LV.forEach((d, i) => rounds.push([i + 1, d]));

const LETTER = { walk: 'w', hop: 'h', fly: 'f', shoot: 's', charge: 'c', drift: 'd', throw: 't', split: 'x' };
const FLYERS = new Set(['fly', 'drift']);
// [jump?, steer, frames before switching, steer after]
const PATTERNS = [];
for (const jump of [1, 0]) for (const d1 of [-1, 0, 1]) for (const sw of [0, 3, 6, 10, 14, 18, 22, 26, 30, 36, 44, 999]) for (const d2 of [-1, 0, 1]) {
  if (!jump && !d1) continue;
  if (sw === 999 && d2) continue;
  PATTERNS.push([jump, d1, sw, d2]);
}

let failed = 0;
for (const [n, d] of rounds) {
  if (only.length && !only.includes(n)) continue;
  const g = buildGrid(d);
  setGrid(g);
  const at = (c, r) => g[r * COLS + c];
  const issues = [];

  if (d.map) {
    const rows = d.map.split('\n').filter(l => l.trim());
    if (rows.length !== ROWS || rows.some(r => r.length !== COLS)) issues.push(`map must be ${ROWS} rows of ${COLS} characters`);
  }
  for (const c of [2, 3, 4, 5, 26, 27, 28, 29]) for (const r of [23, 24]) if (at(c, r)) issues.push(`spawn area blocked at ${c},${r}`);
  for (const c of [3, 4, 27, 28]) if (!at(c, 25)) issues.push(`no floor under a spawn point at column ${c}`);

  // Breadth-first search over standing positions.
  const seen = new Set(), queue = [], stood = new Uint8Array(COLS * ROWS);
  let inWall = null;
  const visit = (x, y) => {
    const key = Math.round(x) + '|' + Math.round(y);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push([x, y]);
    const r = Math.round((y + 16) / T);
    for (let c = Math.floor((x + 4) / T); c <= Math.floor((x + 11) / T); c++) if (r >= 0 && r < ROWS) stood[r * COLS + c] = 1;
  };
  visit(24, PH - 24);
  visit(W - 40, PH - 24);
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [jump, d1, sw, d2] of PATTERNS) {
      const b = { x, y, vx: 0, vy: jump ? JUMPV : 0, onGround: true };
      let airborne = false;
      for (let t = 0; t < 260; t++) {
        b.vx = (t < sw ? d1 : d2) * 1.15;
        moveBody(b);
        if (!inWall && b.y > 0 && b.y < PH - 16) {
          for (let c = Math.floor((b.x + 4) / T); c <= Math.floor((b.x + 11) / T) && !inWall; c++)
            for (let r = Math.floor((b.y + 4) / T); r <= Math.floor((b.y + 14) / T); r++)
              if (at(c, r) === 2) { inWall = `from ${x.toFixed(1)},${y.toFixed(1)} the body reached ${b.x.toFixed(1)},${b.y.toFixed(1)}`; break; }
        }
        if (!b.onGround) airborne = true;
        if (airborne && b.onGround) { visit(b.x, b.y); break; }
        if (!jump && !airborne && t >= 7) { visit(b.x, b.y); break; }
      }
    }
  }
  if (inWall) issues.push('player body entered a wall ' + inWall);

  const map = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push(at(c, r) === 2 ? 'H' : at(c, r) ? '#' : '.');
    map.push(row);
  }
  let surfaces = 0, lost = 0;
  for (let r = 1; r < ROWS; r++) for (let c = 2; c < 30; c++) if (at(c, r) && !at(c, r - 1)) {
    surfaces++;
    if (!stood[r * COLS + c]) { lost++; map[r][c] = '!'; }
  }

  for (const [type, c, r] of d.e) {
    const x = Math.min(Math.max(c * T - 4, 16), W - 32), y = r * T - 16;
    if (map[r - 1] && /[#H!]/.test(map[r - 1][c])) issues.push(`${type} at ${c},${r} starts inside a brick`);
    if (map[r - 1]) map[r - 1][c] = LETTER[type] || '?';
    if (FLYERS.has(type)) continue;
    const b = { x, y, vx: 0, vy: 0, onGround: false };
    for (let k = 0; k < 40; k++) moveBody(b);
    if (!b.onGround || Math.abs(b.y - y) > 1) { issues.push(`${type} at ${c},${r} isn't standing on anything`); continue; }
    let reachable = false;
    for (let cc = Math.floor((x + 4) / T); cc <= Math.floor((x + 11) / T); cc++) if (stood[r * COLS + cc]) reachable = true;
    if (!reachable) issues.push(`${type} at ${c},${r} stands where the player can't reach`);
  }
  // A couple of stray tiles in a corner are fine; more than that usually means a broken route.
  if (lost > 2) issues.push(`${lost}/${surfaces} surface tiles can't be reached (!)`);

  if (issues.length) failed++;
  console.log(`round ${n}: ${issues.length ? issues.join('; ') : 'ok'}  [${d.e.length} enemies]`);
  if (issues.length || show) console.log(map.map((row, r) => String(r).padStart(2) + ' ' + row.join('')).join('\n'));
}
console.log(failed ? `${failed} round(s) need attention` : 'all rounds ok');
process.exit(failed ? 1 : 0);
