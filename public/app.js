import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { EVENT, ZONES, TABLES, zoneOf, prixTable, euros } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ================================================================ textes */
const fill = (sel, v) => $$(sel).forEach((el) => (el.textContent = v));
fill('[data-marque]', EVENT.marque);
fill('[data-theme]', EVENT.theme);
fill('[data-soustheme]', EVENT.sousTheme);
fill('[data-soustheme-up]', EVENT.sousTheme.toUpperCase());
fill('[data-datelongue]', EVENT.dateLongue);
fill('[data-datecourte]', EVENT.dateCourte);
fill('[data-horaires]', EVENT.horaires);
fill('[data-horaires-fr]', EVENT.horairesFr);
fill('[data-lieudetail]', EVENT.lieuDetail);
fill('[data-lieu]', EVENT.lieu);
fill('[data-lieu-up]', EVENT.lieu.toUpperCase());
fill('[data-tagline]', EVENT.tagline);
fill('[data-acompte]', EVENT.acomptePct);
fill('[data-personnes]', EVENT.personnes);
$('#meta-count').textContent = `${TABLES.length} tables · ${EVENT.personnes}`;

/* ================================================================ état (API ou démo) */
let reserved = new Set();
let demo = false;
const LS = 'bal-noel-demo';
async function loadState() {
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    if (!r.ok) throw 0;
    reserved = new Set((await r.json()).reserved);
  } catch {
    demo = true; // hébergement statique : mode démonstration (stockage local)
    try { reserved = new Set(JSON.parse(localStorage.getItem(LS) || '{}').reserved || []); } catch { reserved = new Set(); }
  }
}
async function submitDemande(data) {
  if (demo) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const s = JSON.parse(localStorage.getItem(LS) || '{}');
      (s.demandes ||= []).unshift({ ...data, date: new Date().toISOString() });
      localStorage.setItem(LS, JSON.stringify(s));
    } catch {}
    return { ok: true };
  }
  const r = await fetch('api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Envoi impossible, réessayez.');
  return j;
}

/* ================================================================ neige (accueil) */
function snow(canvas, density = 120) {
  const ctx = canvas.getContext('2d');
  let w, h, flakes;
  const reset = () => {
    w = canvas.width = canvas.offsetWidth * devicePixelRatio;
    h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    flakes = Array.from({ length: density }, () => ({ x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.5 + .4) * devicePixelRatio, s: Math.random() * .45 + .15, o: Math.random() * 6, a: Math.random() * .45 + .2 }));
  };
  reset(); addEventListener('resize', reset);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  (function tick(t) {
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      f.y += f.s * devicePixelRatio; f.x += Math.sin(t / 1400 + f.o) * .4;
      if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
      ctx.fillStyle = `rgba(255,248,235,${f.a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    }
    requestAnimationFrame(tick);
  })(0);
}
snow($('#snow'), innerWidth < 640 ? 35 : 70);

// compte à rebours
function countdown() {
  const el = $('#countdown'); if (!el) return;
  const ms = new Date(EVENT.debut) - Date.now();
  if (ms <= 0) { el.innerHTML = '<div><b>Ce soir</b><small>à partir de 16 h</small></div>'; return; }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1e3) % 60;
  el.innerHTML = [[d, 'jours'], [h, 'heures'], [m, 'min'], [sec, 'sec']].map(([v, u]) => `<div><b>${String(v).padStart(2, '0')}</b><small>${u}</small></div>`).join('');
}
countdown(); setInterval(countdown, 1000);

/* ================================================================ scène 3D */
const PX = 17;               // pixels du plan par mètre
const CX = 627, CY = 389;    // centre de la piste tournante
const V = (x, y, h = 0) => new THREE.Vector3((x - CX) / PX, h, (y - CY) / PX);
const shapeFrom = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - CX) / PX, -(y - CY) / PX)));
const mirror = (pts) => pts.map(([x, y]) => [2 * CX - x, y]).reverse();

const canvas = $('#scene');
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0708');
scene.fog = new THREE.Fog('#0a0708', 70, 150);

const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
const HOME = { pos: new THREE.Vector3(0, 40, 33), target: new THREE.Vector3(0, 0, 3) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.zoomToCursor = true;
controls.minDistance = 7;
controls.maxDistance = 90;
controls.maxPolarAngle = 1.32;
controls.screenSpacePanning = false;

// lumières : ambiance chaude de salle de bal + touches de couleur de Noël
scene.add(new THREE.HemisphereLight('#fff1dc', '#5a2a2a', 1.35));
const sun = new THREE.DirectionalLight('#ffd9a3', 1.4); sun.position.set(-20, 40, 25); scene.add(sun);
[[-16, 6, -6, '#ffb877'], [16, 6, -6, '#ffb877'], [0, 6, 14, '#ff9a7a'], [0, 7, -14, '#ffd59a']].forEach(([x, y, z, c]) => {
  const l = new THREE.PointLight(c, 120, 40, 1.6); l.position.set(x, y, z); scene.add(l);
});

// textures procédurales
function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t;
}
const woodTex = canvasTex(512, 512, (g, w) => {
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    g.fillStyle = (i + j) % 2 ? '#2a2224' : '#1f191b'; g.fillRect(i * 64, j * 64, 64, 64);
  }
  g.strokeStyle = 'rgba(201,164,92,.45)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, w); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
}, .09);
const carpetTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#4a0c18'; g.fillRect(0, 0, w, w);
  g.strokeStyle = 'rgba(201,164,92,.22)'; g.lineWidth = 3;
  for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + w, w); g.moveTo(i + w, 0); g.lineTo(i, w); g.stroke(); }
}, .25);
const pisteTex = canvasTex(512, 512, (g, w) => {
  const r = w / 2; g.fillStyle = '#141012'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 32; i++) { g.fillStyle = i % 2 ? '#1c1618' : '#120e10'; g.beginPath(); g.moveTo(r, r); g.arc(r, r, r, i * Math.PI / 16, (i + 1) * Math.PI / 16); g.fill(); }
  g.strokeStyle = '#c9a45c'; g.lineWidth = 8; g.beginPath(); g.arc(r, r, r - 6, 0, 7); g.stroke();
  g.lineWidth = 1.5; [.78, .5].forEach((k) => { g.beginPath(); g.arc(r, r, r * k, 0, 7); g.stroke(); });
  g.fillStyle = '#c9a45c'; g.beginPath();
  for (let i = 0; i < 16; i++) { const rr = i % 2 ? 18 : 70, a = i * Math.PI / 8; i ? g.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr) : g.moveTo(r + rr, r); }
  g.fill();
});
const M = {
  floor: new THREE.MeshStandardMaterial({ map: woodTex, roughness: .55, metalness: .1 }),
  carpet: new THREE.MeshStandardMaterial({ map: carpetTex, roughness: .9 }),
  gold: new THREE.MeshStandardMaterial({ color: '#c9a25a', roughness: .35, metalness: .85 }),
  wall: new THREE.MeshStandardMaterial({ color: '#2e0b13', roughness: .55 }),
  wallLow: new THREE.MeshStandardMaterial({ color: '#24090f', roughness: .6 }),
  snow: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#5a3418', roughness: .9 }),
  window: new THREE.MeshStandardMaterial({ color: '#1a2a3a', emissive: '#ffb45a', emissiveIntensity: .55, roughness: .3 }),
  sofa: new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: .9 }),
  table: new THREE.MeshStandardMaterial({ color: '#c9a25a', roughness: .3, metalness: .8 }),
  dark: new THREE.MeshStandardMaterial({ color: '#141414', roughness: .6 }),
  bar: new THREE.MeshStandardMaterial({ color: '#d8c08c', roughness: .5, metalness: .2 }),
  barTop: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: .3, metalness: .3 }),
  tree: new THREE.MeshStandardMaterial({ color: '#173a2b', roughness: .85 }),
};

const blinkers = [];
const BULB_COLORS = ['#ffe3a8', '#fff1d6', '#ffd889', '#fff1d6'];
const BULB_GEO = new THREE.SphereGeometry(.06, 8, 8);

// sol de la salle (contour relevé sur le plan)
const ROOM = [[130, 500], [250, 345], [395, 180], [590, 100], [664, 100], [860, 180], [1005, 345], [1125, 500], [1090, 532], [940, 572], [810, 612], [700, 742], [627, 772], [554, 742], [444, 612], [314, 572], [164, 532]];
{
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(ROOM)), M.floor);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // grand sol extérieur sombre
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#100c0d', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; scene.add(ground);
}
// murs : hauts au fond (côté VIP), bas côté entrée/scène pour garder la vue
ROOM.forEach((p, i) => {
  const q = ROOM[(i + 1) % ROOM.length];
  const a = V(...p), b = V(...q);
  const len = a.distanceTo(b);
  const back = i < 7;
  const h = back ? 6 : 1.4;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, .35), back ? M.wall : M.wallLow);
  wall.position.copy(a).lerp(b, .5); wall.position.y = h / 2;
  wall.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  scene.add(wall);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .42), M.gold);
  rail.position.copy(wall.position); rail.position.y = h; rail.rotation.y = wall.rotation.y; scene.add(rail);
  // guirlande lumineuse le long du mur
  const nb = Math.floor(len / .9);
  for (let k = 0; k < nb; k++) {
    const c = BULB_COLORS[k % 4];
    const bulb = new THREE.Mesh(BULB_GEO, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 }));
    bulb.position.copy(a).lerp(b, (k + .5) / nb); bulb.position.y = h - .35 - Math.sin(((k + .5) / nb * len / 1.8) % 1 * Math.PI) * .35;
    bulb.rotation.y = wall.rotation.y; bulb.translateZ(back ? .3 : .25); scene.add(bulb); blinkers.push(bulb);
  }
  if (back) {
    // arcades lumineuses
    const n = Math.max(1, Math.floor(len / 3.2));
    for (let k = 0; k < n; k++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), M.window);
      win.position.copy(a).lerp(b, (k + .5) / n); win.position.y = 2.6;
      win.rotation.y = wall.rotation.y + Math.PI;
      win.translateZ(.19); scene.add(win);
    }
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.35, .4, back ? 6.6 : 1.8, 16), M.gold);
  col.position.copy(a); col.position.y = (back ? 6.6 : 1.8) / 2; scene.add(col);
});

// estrades VIP +0,60
const H = .6;
const FOND_L = [[445, 205], [505, 160], [615, 160], [615, 258], [540, 258], [468, 258]];
const WING_L = [[290, 325], [420, 235], [470, 292], [335, 385]];
const SCENE = [[450, 588], [470, 557], [785, 557], [805, 588], [700, 702], [627, 714], [554, 702]];
const PLATFORMS = [FOND_L, mirror(FOND_L), WING_L, mirror(WING_L), SCENE];
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const heightAt = (x, y) => (PLATFORMS.some((p) => inPoly(x, y, p)) ? H : 0);
PLATFORMS.forEach((pts) => {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: H, bevelEnabled: false });
  const m = new THREE.Mesh(geo, [M.carpet, M.gold]);
  m.rotation.x = -Math.PI / 2; scene.add(m);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#f0d08a' }));
  edge.rotation.x = -Math.PI / 2; scene.add(edge);
});

// piste tournante Ø 7,30 m
const piste = new THREE.Mesh(new THREE.CylinderGeometry(3.65, 3.65, .14, 64), [new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: .8, roughness: .3 }), new THREE.MeshStandardMaterial({ map: pisteTex, roughness: .35, metalness: .3 }), M.dark]);
piste.position.copy(V(CX, CY, .07)); scene.add(piste);
const ring = new THREE.Mesh(new THREE.TorusGeometry(3.75, .06, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
ring.rotation.x = Math.PI / 2; ring.position.copy(V(CX, CY, .15)); scene.add(ring);

// grande étoile et boules de Noël suspendues au-dessus de la salle
const bigStar = new THREE.Group();
{
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .55 : 1.3, a = i * Math.PI / 5 + Math.PI / 2; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const st = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .3, bevelEnabled: true, bevelSize: .08, bevelThickness: .08 }), new THREE.MeshStandardMaterial({ color: '#ffd35a', emissive: '#ffb800', emissiveIntensity: 1.6, metalness: .6, roughness: .3 }));
  st.position.z = -.15; bigStar.add(st);
  bigStar.position.copy(V(CX, CY, 8.5)); scene.add(bigStar);
  const glow = new THREE.PointLight('#ffd27a', 80, 22); glow.position.copy(V(CX, CY, 7)); scene.add(glow);
}
const floaters = [];
[[540, 330, 7, '#c9a45c'], [715, 330, 6.6, '#6b1424'], [560, 450, 6.2, '#e9d3a0'], [700, 455, 7.2, '#c9a45c'], [460, 400, 7.5, '#6b1424'], [800, 400, 7, '#e9d3a0']].forEach(([x, y, h, c], k) => {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.45, 24, 24), new THREE.MeshStandardMaterial({ color: c, metalness: .7, roughness: .15, emissive: c, emissiveIntensity: .08 }));
  ball.position.copy(V(x, y, h)); scene.add(ball);
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .16, 12), M.gold); capB.position.y = .5; ball.add(capB);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 12 - h, 4), M.gold); str.position.y = .5 + (12 - h) / 2; ball.add(str);
  floaters.push({ ball, h, k });
});

// DJ
{
  const dj = new THREE.Group();
  const booth = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 2.2), M.dark); booth.position.y = .6; dj.add(booth);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff3355', emissiveIntensity: 1.2 }));
  front.position.set(0, .6, -1.11); front.rotation.y = Math.PI; dj.add(front);
  dj.position.copy(V(627, 566, H)); scene.add(dj);
}

// bars
[[373, 485, -22], [880, 485, 22]].forEach(([x, y, a]) => {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.BoxGeometry(6, 1.15, 4.8), M.bar); outer.position.y = .58; g.add(outer);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, .08, 5), M.barTop); top.position.y = 1.18; g.add(top);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 1.6), M.barTop); inner.position.y = 1.1; g.add(inner);
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .4, 8), new THREE.MeshStandardMaterial({ color: '#000', emissive: i % 2 ? '#ffcc66' : '#66ffaa', emissiveIntensity: .9 }));
    b.position.set(-1.1 + i * .245, 2.4, 0); g.add(b);
  }
  g.position.copy(V(x, y)); g.rotation.y = THREE.MathUtils.degToRad(a); scene.add(g);
  const l = new THREE.PointLight('#ffcf80', 30, 12); l.position.copy(V(x, y, 4)); scene.add(l);
});

// sapins de Noël 4 m (S1 → S6 sur le plan) avec guirlandes clignotantes
[[510, 682, 3], [746, 682, 3], [198, 462, 4], [1053, 462, 4], [440, 553, 4], [818, 553, 4]].forEach(([x, y, h]) => {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, .5, 8), M.trunk); trunk.position.y = .25; g.add(trunk);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.6, .45, .55, 16), M.gold); pot.position.y = .27; g.add(pot);
  for (let i = 0; i < 4; i++) {
    const r = 1.35 * (1 - i * .2), ch = h * .38;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 18), M.tree); cone.position.y = .5 + i * h * .2 + ch / 2; g.add(cone);
  }
  const colors = ['#ffe3a8', '#fff4dc', '#ffd27a', '#fff4dc'];
  for (let i = 0; i < 34; i++) {
    const t = Math.random(), yy = .7 + t * h * .82, rr = 1.3 * (1 - t) + .08, ang = i * 2.4;
    const c = colors[i % 4];
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 }));
    bulb.position.set(Math.cos(ang) * rr, yy, Math.sin(ang) * rr); g.add(bulb); blinkers.push(bulb);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffcf4a', emissiveIntensity: 2.5 }));
  star.position.y = .5 + h + .2; g.add(star);

  g.position.copy(V(x, y, heightAt(x, y))); scene.add(g);
  const l = new THREE.PointLight('#ffb35a', 14, 8); l.position.copy(V(x, y, 2.5)); scene.add(l);
});

// tables : canapés + tables basses
const TABLE_OBJ = new Map();
const sofaGeo = new THREE.BoxGeometry(1.45, .42, .75);
const backGeo = new THREE.BoxGeometry(1.45, .5, .18);
const lowGeo = new THREE.CylinderGeometry(.22, .22, .38, 16);
TABLES.forEach((t) => {
  const g = new THREE.Group();
  const mats = [];
  for (let i = 0; i < t.n; i++) {
    const x = (i - (t.n - 1) / 2) * 1.55;
    const mat = M.sofa.clone(); mats.push(mat);
    const s = new THREE.Mesh(sofaGeo, mat); s.position.set(x, .21, -.3); g.add(s);
    const b = new THREE.Mesh(backGeo, mat); b.position.set(x, .55, -.6); g.add(b);
    const lt = new THREE.Mesh(lowGeo, M.table); lt.position.set(x, .19, .45); g.add(lt);
  }
  const h = heightAt(t.x, t.y);
  g.position.copy(V(t.x, t.y, h));
  // canapés dos au mur, face à la piste (VIP fond) ou dos à l'entrée (scène)
  const onStage = !t.zone.startsWith('fond') && t.zone !== 'ailes';
  g.rotation.y = (onStage ? Math.PI : 0) + THREE.MathUtils.degToRad(-t.a);
  scene.add(g);
  TABLE_OBJ.set(t.id, { group: g, mats, anchor: V(t.x, t.y, h + 1.25) });
});

// neige dans la salle
const SNOW_N = 900;
const snowGeo = new THREE.BufferGeometry();
const sp = new Float32Array(SNOW_N * 3);
for (let i = 0; i < SNOW_N; i++) { sp[i * 3] = (Math.random() - .5) * 70; sp[i * 3 + 1] = Math.random() * 18; sp[i * 3 + 2] = (Math.random() - .5) * 46; }
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: .12, transparent: true, opacity: .8, depthWrite: false }));
scene.add(snowPts);

/* ================================================================ étiquettes */
const labels = $('#labels');
const LABEL = new Map();
TABLES.forEach((t) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'tlabel'; b.textContent = t.id;
  b.style.setProperty('--zc', zoneOf(t).couleurs.at(-1));
  b.title = `Table ${t.id} · ${zoneOf(t).nom} · ${euros(prixTable(t))}`;
  b.addEventListener('click', () => openDrawer(t));
  b.addEventListener('pointerenter', () => highlight(t.id, true));
  b.addEventListener('pointerleave', () => highlight(t.id, false));
  labels.appendChild(b); LABEL.set(t.id, b);
});
function highlight(id, on) {
  const o = TABLE_OBJ.get(id);
  o.mats.forEach((m) => { m.emissive.set(on ? '#d9b878' : '#000'); m.emissiveIntensity = on ? .5 : 0; });
}
const tmp = new THREE.Vector3();
function placeLabels() {
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const [id, b] of LABEL) {
    tmp.copy(TABLE_OBJ.get(id).anchor).project(camera);
    const off = tmp.z > 1 || Math.abs(tmp.x) > 1.2 || Math.abs(tmp.y) > 1.2;
    b.style.visibility = off ? 'hidden' : '';
    b.style.transform = `translate(${(tmp.x * .5 + .5) * w}px, ${(-tmp.y * .5 + .5) * h}px) translate(-50%, -50%)`;
    b.style.zIndex = String(1000 - Math.round(tmp.z * 1000));
  }
}

/* ================================================================ caméra */
let fly = null;
function flyTo(pos, target, ms = 900) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms };
}
function flyHome() { flyTo(HOME.pos.clone(), HOME.target.clone()); }
function flyZone(zoneId) {
  const ts = TABLES.filter((t) => t.zone === zoneId);
  const box = new THREE.Box3(); ts.forEach((t) => box.expandByPoint(TABLE_OBJ.get(t.id).anchor));
  const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
  const dist = Math.max(15, size * 1.5);
  const pos = c.clone().add(new THREE.Vector3(0, dist * .85, dist * .75));
  flyTo(pos, c);
}
function zoomBy(f) {
  const d = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(d.length() * f, controls.minDistance, controls.maxDistance);
  flyTo(controls.target.clone().add(d.setLength(len)), controls.target.clone(), 350);
}
$('#zoom-in').onclick = () => zoomBy(.75);
$('#zoom-out').onclick = () => zoomBy(1.33);
$('#btn-overview').onclick = () => selectZone(null);
controls.addEventListener('start', () => (fly = null));
const ease = (t) => 1 - Math.pow(1 - t, 3);

/* ================================================================ boucle */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < 640 ? 55 : 42;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta(), t = clock.elapsedTime;
  piste.rotation.y += dt * .25;
  bigStar.rotation.y += dt * .6; bigStar.position.y = 8.5 + Math.sin(t * 1.2) * .25;
  floaters.forEach((f) => (f.ball.position.y = f.h + Math.sin(t * 1.3 + f.k) * .15));
  blinkers.forEach((b, i) => (b.material.emissiveIntensity = 1.6 + Math.sin(t * 1.6 + i * 1.7) * .7));
  const p = snowGeo.attributes.position;
  for (let i = 0; i < SNOW_N; i++) { let y = p.getY(i) - dt * (.6 + (i % 5) * .15); if (y < 0) y = 18; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t + i) * .003); }
  p.needsUpdate = true;
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.start) / fly.ms), e = ease(k);
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k === 1) fly = null;
  }
  controls.update();
  renderer.render(scene, camera);
  placeLabels();
});
$('#loading').remove();

/* ================================================================ zones */
let activeZone = null;
const zonesEl = $('#zones');
function renderZones() {
  const free = (z) => TABLES.filter((t) => t.zone === z.id && !reserved.has(t.id)).length;
  const fmt = (p) => (Array.isArray(p) ? `${euros(p[0])} – ${euros(p[1])}` : euros(p));
  zonesEl.innerHTML = '';
  const all = document.createElement('li');
  all.innerHTML = `<button type="button" class="zone all ${activeZone ? '' : 'active'}"><span class="zn">Toute la salle</span><small>${TABLES.length} tables ↗</small></button>`;
  all.firstChild.onclick = () => selectZone(null);
  zonesEl.appendChild(all);
  ZONES.forEach((z) => {
    const n = free(z);
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="zone ${activeZone === z.id ? 'active' : ''} ${n ? '' : 'full'}">
      <span class="zn">${z.nom} <span class="sw">${z.couleurs.map((c) => `<i style="background:${c}"></i>`).join('')}</span></span>
      <span class="zp"><strong>${fmt(z.prix)}</strong><small>${n} disponible${n > 1 ? 's' : ''} · ${z.capacite} pers.</small></span></button>`;
    li.firstChild.onclick = () => selectZone(z.id);
    zonesEl.appendChild(li);
  });
}
function selectZone(id) {
  activeZone = id;
  renderZones(); refreshLabels();
  id ? flyZone(id) : flyHome();
  if (id && innerWidth <= 1100) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function refreshLabels() {
  const only = $('#only-free').checked;
  for (const t of TABLES) {
    const b = LABEL.get(t.id), taken = reserved.has(t.id);
    b.classList.toggle('taken', taken);
    b.classList.toggle('hide', only && taken);
    b.classList.toggle('dim', !!activeZone && t.zone !== activeZone);
    TABLE_OBJ.get(t.id).mats.forEach((m) => m.color.set(taken ? '#3a3234' : '#e6dccb'));
  }
}
$('#only-free').onchange = refreshLabels;
$('#collapse').onclick = (e) => { const c = $('#side').classList.toggle('closed'); e.currentTarget.textContent = c ? '+' : '−'; };

/* ================================================================ fiche table + formulaire */
const drawer = $('#drawer'), back = $('#drawer-back'), form = $('#form');
let current = null;
function openDrawer(t) {
  current = t;
  const z = zoneOf(t), prix = prixTable(t), taken = reserved.has(t.id);
  LABEL.forEach((b) => b.classList.remove('sel')); LABEL.get(t.id).classList.add('sel');
  $('#d-zone').textContent = z.nom;
  $('#d-title').textContent = `Table ${t.id}`;
  $('#d-price').textContent = euros(prix);
  $('#d-cap').textContent = `${z.capacite} pers.`;
  $('#d-dep').textContent = euros(Math.round(prix * EVENT.acomptePct / 100));
  $('#d-pers').innerHTML = Array.from({ length: z.capacite }, (_, i) => `<option ${i + 1 === z.capacite ? 'selected' : ''}>${i + 1}</option>`).join('');
  $('#d-taken').hidden = !taken; form.hidden = taken;
  $('#d-error').hidden = true;
  $('#d-form-view').hidden = false; $('#d-ok-view').hidden = true;
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); back.hidden = false;
  setTimeout(() => (taken ? $('#drawer-close') : form.prenom).focus({ preventScroll: true }), 350);
}
function closeDrawer() {
  drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); back.hidden = true;
  LABEL.forEach((b) => b.classList.remove('sel'));
}
$('#drawer-close').onclick = closeDrawer; back.onclick = closeDrawer; $('#d-ok-close').onclick = closeDrawer;
addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#d-error'); err.hidden = true;
  const f = Object.fromEntries(new FormData(form));
  const problems = [];
  if (!f.prenom.trim() || !f.nom.trim()) problems.push('indiquez votre prénom et votre nom');
  if (f.tel.replace(/\D/g, '').length < 8) problems.push('indiquez un numéro de téléphone valide');
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) problems.push('l’e-mail semble incorrect');
  if (!f.cgv) problems.push('cochez la case concernant l’acompte');
  if (problems.length) { err.textContent = 'Merci de vérifier : ' + problems.join(', ') + '.'; err.hidden = false; return; }
  const btn = $('#d-submit'); btn.disabled = true;
  try {
    await submitDemande({ table: current.id, prenom: f.prenom, nom: f.nom, tel: f.tel, email: f.email, personnes: f.personnes, contact: f.contact, message: f.message, website: f.website });
    const dep = euros(Math.round(prixTable(current) * EVENT.acomptePct / 100));
    $('#d-ok-text').innerHTML = `Merci ${escapeHtml(f.prenom)} ! Votre demande pour la <strong>table ${current.id}</strong> (${zoneOf(current).nom}) est bien enregistrée.<br><br>
      L’organisation vous contacte par <strong>${f.contact === 'sms' ? 'SMS' : 'WhatsApp'}</strong> au ${escapeHtml(f.tel)} dans les heures qui suivent.
      Un acompte de ${EVENT.acomptePct} % (${dep}) vous sera demandé après validation.`;
    $('#d-form-view').hidden = true; $('#d-ok-view').hidden = false;
    form.reset();
  } catch (x) {
    err.textContent = x.message; err.hidden = false;
    await loadState(); refreshLabels(); renderZones();
  } finally { btn.disabled = false; }
});
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ================================================================ démarrage */
await loadState();
renderZones(); refreshLabels();
setInterval(async () => { if (!demo && document.visibilityState === 'visible') { await loadState(); refreshLabels(); renderZones(); } }, 30000);
