// Collisions du plan 3D : rien ne doit traverser un mur ni se chevaucher (relevé du plan Deco Flamme).
//   node --test tests/plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, PLATFORMS, SOFAS, LOUNGES, BOOTHS, BANQUETTES, BARS, DJ } from '../public/plan.js';

const rect = (x, z, w, d, a) => { const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, t]) => [x + s * w / 2 * ux + t * d / 2 * vx, z + s * w / 2 * uz + t * d / 2 * vz]); };
const dedans = ([x, y], P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const croise = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
// polygone entièrement dans la salle : sommets dedans et aucun côté ne coupe un mur
const dansSalle = (P) => P.every((p) => dedans(p, ROOM)) && P.every((p, i) => ROOM.every((r, k) => !croise(p, P[(i + 1) % P.length], r, ROOM[(k + 1) % ROOM.length])));
// chevauchement de deux polygones convexes (axes séparateurs), avec une tolérance de 3 cm
function chevauche(A, B, tol = .03) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], n = [y1 - y2, x2 - x1], l = Math.hypot(...n);
    const pr = (Q) => Q.map(([x, y]) => (x * n[0] + y * n[1]) / l);
    const a = pr(A), b = pr(B);
    if (Math.max(...a) - tol <= Math.min(...b) || Math.max(...b) - tol <= Math.min(...a)) return false;
  }
  return true;
}
const modules = SOFAS.map((m) => rect(...m.slice(0, 5)));
const tables = LOUNGES.flatMap((l, li) => l.tables.map((t) => {
  const m = SOFAS.filter((s) => s[6] === li).sort((p, q) => Math.hypot(p[0] - t[0], p[1] - t[1]) - Math.hypot(q[0] - t[0], q[1] - t[1]))[0];
  return rect(t[0], t[1], .72, .72, m[4]);
}));
const loges = BOOTHS.map(([x, z]) => rect(x, z + .55, 2.8, 2.2, 0));          // emprise de chaque loge ronde
const banquettes = BANQUETTES.map((b) => { const [[x1, z1], [x2, z2]] = b.sofa; return rect((x1 + x2) / 2, (z1 + z2) / 2, Math.hypot(x2 - x1, z2 - z1), .65, Math.atan2(z2 - z1, x2 - x1)); });
const bars = BARS.map((b) => rect(b.x, b.z, 5.3, 3, b.a * Math.PI / 180));
const regie = rect(DJ[0], DJ[1], 4.4, 2.4, 0);
const sapins = [-23, 23].map((x) => rect(x, 2.5, 2.7, 2.7, 0));

test('plan : canapés, tables, estrades, bars, scène et sapins sont tous dans la salle', () => {
  const tout = { canapé: modules, table: tables, estrade: PLATFORMS, loge: loges, banquette: banquettes, bar: bars, régie: [regie], sapin: sapins };
  const hors = Object.entries(tout).flatMap(([k, L]) => L.map((P, i) => (dansSalle(P) ? null : `${k} ${i}`)).filter(Boolean));
  assert.deepEqual(hors, [], 'traverse un mur : ' + hors.join(', '));
});
test('plan : aucun canapé ni aucune table ne se chevauchent', () => {
  const L = [...modules.map((p, i) => ['canapé ' + i, p]), ...tables.map((p, i) => ['table ' + i, p])], pb = [];
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (chevauche(L[i][1], L[j][1])) pb.push(`${L[i][0]} / ${L[j][0]}`);
  assert.deepEqual(pb, []);
});
test('plan : bars, sapins et régie ne touchent ni les estrades ni les salons', () => {
  const pb = [];
  for (const [n, P] of [...bars.map((p, i) => ['bar ' + i, p]), ...sapins.map((p, i) => ['sapin ' + i, p])])
    for (const [k, E] of PLATFORMS.entries()) if (P.some((q) => dedans(q, E)) || E.some((q) => dedans(q, P))) pb.push(`${n} / estrade ${k}`);
  for (const [n, P] of [...loges.map((p, i) => ['loge ' + i, p]), ...banquettes.map((p, i) => ['banquette ' + i, p])]) if (chevauche(P, regie)) pb.push(`${n} / régie`);
  assert.deepEqual(pb, []);
});
test('plan : le mur ne coupe jamais une estrade', () => {
  // le tracé est la face intérieure du mur : une estrade peut le toucher, pas le dépasser
  for (const E of PLATFORMS) assert.ok(dansSalle(E));
});
