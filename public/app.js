import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { EVENT, ZONES, TABLES, ROWS, zoneOf, prixTable, euros } from './config.js';

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

/* ================================================================ accueil */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroEl = $('#accueil');
let heroVisible = true;
new IntersectionObserver((e) => (heroVisible = e[0].isIntersecting)).observe(heroEl);

// neige : une seule boucle pour la neige de l'accueil et celle de la boule,
// arrêtée dès que l'accueil n'est plus à l'écran (aucun coût pendant le défilement du plan)
function flakesFor(cv, n, area) {
  const d = Math.min(devicePixelRatio, 1.5);
  const st = { cv, ctx: cv.getContext('2d'), d, area, list: [] };
  const size = () => {
    st.w = cv.width = Math.round(cv.offsetWidth * d); st.h = cv.height = Math.round(cv.offsetHeight * d);
    st.list = Array.from({ length: n }, () => ({ x: Math.random() * st.w, y: Math.random() * st.h * area.bottom, r: (Math.random() * area.r + .5) * d, s: (Math.random() * area.s + .15) * d, o: Math.random() * 6, a: Math.random() * .45 + area.a }));
  };
  size(); addEventListener('resize', size, { passive: true });
  return st;
}
const snows = [];
if ($('#snow')) snows.push(flakesFor($('#snow'), innerWidth < 640 ? 30 : 55, { bottom: 1, r: 1.3, s: .35, a: .15, top: 0 }));
if ($('#globe-snow')) snows.push(flakesFor($('#globe-snow'), 90, { bottom: .74, r: 1.4, s: .3, a: .45, top: .08, inside: true }));
function snowTick(t) {
  if (heroVisible && !document.hidden) for (const st of snows) {
    const { ctx, w, h, area } = st;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#fff';
    for (const f of st.list) {
      f.y += f.s; f.x += Math.sin(t / 1100 + f.o) * .3;
      if (f.y > h * area.bottom) { f.y = h * area.top; f.x = area.inside ? w * (.15 + Math.random() * .7) : Math.random() * w; }
      ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(snowTick);
}
if (!reduceMotion) requestAnimationFrame(snowTick);

// ouverture : entièrement en CSS (opacity/transform) ; on enlève juste le calque à la fin
setTimeout(() => { const i = $('#intro'); if (i) i.hidden = true; }, document.documentElement.classList.contains('quick') ? 1500 : 3600);
try { sessionStorage.setItem('bal-noel-intro', '1'); } catch {}

// défilement adouci (Lenis) ; le plan 3D et la fiche gardent la molette pour eux
let lenis = null;
function startLenis() {
  if (reduceMotion || !window.Lenis || matchMedia('(pointer: coarse)').matches) return;
  lenis = new window.Lenis({ lerp: .11, wheelMultiplier: .9 });
  if (location.hash !== '#plan') lenis.stop(); // la page du plan (lien direct ou actualisation) doit défiler
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
}
window.Lenis ? startLenis() : addEventListener('load', startLenis);
const scrollToEl = (el, offset = 0) => (lenis ? lenis.scrollTo(el, { offset, duration: 1.2 }) : el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));

// deux pages : l'accueil, puis le plan (ouvert par « Choisir ma table »)
const body = document.body;
function showView(v, animate = true) {
  if (body.dataset.view === v) return;
  const go = () => {
    body.dataset.view = v;
    if (lenis) lenis.scrollTo(0, { immediate: true }); else scrollTo(0, 0);
    body.classList.remove('leaving');
    if (animate && !reduceMotion) { body.classList.add('entering'); setTimeout(() => body.classList.remove('entering'), 1100); }
    if (v === 'plan') { lenis && lenis.start(); dispatchEvent(new Event('resize')); } else lenis && lenis.stop();
  };
  if (animate && !reduceMotion && v === 'plan') { body.classList.add('leaving'); setTimeout(go, 650); } else go();
}
$$('a[href="#reserver"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (a.classList.contains('loading')) return; history.pushState({ v: 'plan' }, '', '#plan'); showView('plan'); }));
$$('a[href="#accueil"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); history.pushState({ v: 'hero' }, '', location.pathname); showView('hero'); }));
addEventListener('popstate', () => showView(location.hash === '#plan' ? 'plan' : 'hero'));
body.dataset.view = location.hash === '#plan' ? 'plan' : 'hero';

/* ================================================================ scène 3D */
const PX = 17;               // pixels du plan par mètre
const CX = 627, CY = 389;    // centre de la piste tournante
const V = (x, y, h = 0) => new THREE.Vector3((x - CX) / PX, h, (y - CY) / PX);
const shapeFrom = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - CX) / PX, -(y - CY) / PX)));
const mirror = (pts) => pts.map(([x, y]) => [2 * CX - x, y]).reverse();

const canvas = $('#scene');
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a1430');
scene.fog = new THREE.Fog('#0a1430', 70, 150);

const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
const HOME = { pos: new THREE.Vector3(0, 40, 33), target: new THREE.Vector3(0, 0, 3) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.zoomToCursor = true;
controls.minDistance = 3.5;
controls.maxDistance = 130;
controls.maxPolarAngle = 1.32;
controls.screenSpacePanning = false;

// lumières : ambiance chaude de salle de bal + touches de couleur de Noël
scene.add(new THREE.HemisphereLight('#fff1dc', '#3a2a40', 1.7));
const sun = new THREE.DirectionalLight('#ffd9a3', 1.5); sun.position.set(-20, 40, 25); scene.add(sun);
[[-14, 7, -4, '#ffb877'], [14, 7, -4, '#ffb877']].forEach(([x, y, z, c]) => {
  const l = new THREE.PointLight(c, 170, 46, 1.6); l.position.set(x, y, z); scene.add(l);
});

// textures procédurales
function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4; return t;
}
const woodTex = canvasTex(512, 512, (g, w) => {
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    g.fillStyle = (i + j) % 2 ? '#22304f' : '#1a2541'; g.fillRect(i * 64, j * 64, 64, 64);
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
  const r = w / 2; g.fillStyle = '#101a33'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 32; i++) { g.fillStyle = i % 2 ? '#1a2848' : '#111c36'; g.beginPath(); g.moveTo(r, r); g.arc(r, r, r, i * Math.PI / 16, (i + 1) * Math.PI / 16); g.fill(); }
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

// toutes les ampoules (murs + sapins) sont dessinées en un seul appel (InstancedMesh)
const bulbSpots = [];
const BULB_COLORS = ['#ffe3a8', '#fff1d6', '#ffd889', '#fff1d6'];

// sol de la salle (contour relevé sur le plan)
const ROOM = [[130, 500], [250, 345], [395, 180], [590, 100], [664, 100], [860, 180], [1005, 345], [1125, 500], [1090, 532], [940, 572], [810, 612], [700, 742], [627, 772], [554, 742], [444, 612], [314, 572], [164, 532]];
{
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(ROOM)), M.floor);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // grand sol extérieur sombre
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#0c1730' }));
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
    const o = new THREE.Object3D();
    o.position.copy(a).lerp(b, (k + .5) / nb); o.position.y = h - .35 - Math.sin(((k + .5) / nb * len / 1.8) % 1 * Math.PI) * .35;
    o.rotation.y = wall.rotation.y; o.translateZ(back ? .3 : .25);
    bulbSpots.push({ pos: o.position.clone(), color: BULB_COLORS[k % 4], r: .06 });
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
const pisteRing = new THREE.Mesh(new THREE.TorusGeometry(3.75, .06, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
pisteRing.rotation.x = Math.PI / 2; pisteRing.position.copy(V(CX, CY, .15)); scene.add(pisteRing);

// grande étoile et boules de Noël suspendues au-dessus de la salle
const bigStar = new THREE.Group();
{
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .55 : 1.3, a = i * Math.PI / 5 + Math.PI / 2; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const st = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .3, bevelEnabled: true, bevelSize: .08, bevelThickness: .08 }), new THREE.MeshStandardMaterial({ color: '#ffd35a', emissive: '#ffb800', emissiveIntensity: 1.6, metalness: .6, roughness: .3 }));
  st.position.z = -.15; bigStar.add(st);
  bigStar.position.copy(V(CX, CY, 8.5)); scene.add(bigStar);
  const glow = new THREE.PointLight('#ffd27a', 110, 24); glow.position.copy(V(CX, CY, 7)); scene.add(glow);
}
const floaters = [];
[[540, 330, 7, '#e8b04a'], [715, 330, 6.6, '#5c7fb8'], [560, 450, 6.2, '#f4f6fb'], [700, 455, 7.2, '#e8b04a'], [460, 400, 7.5, '#7a1424'], [800, 400, 7, '#5c7fb8']].forEach(([x, y, h, c], k) => {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.45, 24, 24), new THREE.MeshStandardMaterial({ color: c, metalness: .7, roughness: .15, emissive: c, emissiveIntensity: .08 }));
  ball.position.copy(V(x, y, h)); scene.add(ball);
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .16, 12), M.gold); capB.position.y = .5; ball.add(capB);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 12 - h, 4), M.gold); str.position.y = .5 + (12 - h) / 2; ball.add(str);
  floaters.push({ ball, h, k });
});

// Régie DJ du Bal des Fous : comptoir blanc au logo tourné vers la piste, platines,
// structure en treillis (truss) et enceintes. Repère local : -z = côté piste.
{
  const dj = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: .55 });
  const black = new THREE.MeshStandardMaterial({ color: '#1b1c22', roughness: .45, metalness: .3 });
  const steel = new THREE.MeshStandardMaterial({ color: '#3d4048', roughness: .35, metalness: .85 });
  // comptoir
  const W = 4.2, D = 1.1, HT = 1.15;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(W, HT, D), white); desk.position.set(0, HT / 2, 0); dj.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + .1, .05, D + .1), black); top.position.y = HT + .025; dj.add(top);
  // façade avec le logo, côté piste
  const logoTex = new THREE.TextureLoader().load('assets/logo-sombre.webp'); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4;
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.35), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: .6 }));
  facade.position.set(0, HT / 2 + .02, -D / 2 - .006); facade.rotation.y = Math.PI; dj.add(facade);
  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(W, .04, .04), new THREE.MeshBasicMaterial({ color: '#ffd98a', toneMapped: false }));
  glowStrip.position.set(0, .04, -D / 2 - .03); dj.add(glowStrip);
  // matériel : 4 platines, table de mixage, ordinateur
  const yTop = HT + .05;
  [-1.35, -.8, .8, 1.35].forEach((x) => {
    const cdj = new THREE.Mesh(new THREE.BoxGeometry(.42, .1, .5), black); cdj.position.set(x, yTop + .05, .05); dj.add(cdj);
    const jog = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .03, 24), steel); jog.position.set(x, yTop + .115, .1); dj.add(jog);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.14, .012, 6, 32), new THREE.MeshBasicMaterial({ color: '#9fd0ff', toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, yTop + .13, .1); dj.add(ring);
  });
  const mixer = new THREE.Mesh(new THREE.BoxGeometry(.55, .1, .5), black); mixer.position.set(0, yTop + .05, .05); dj.add(mixer);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.03, .02, .12), new THREE.MeshBasicMaterial({ color: '#ffd98a', toneMapped: false })); f.position.set(-.18 + i * .12, yTop + .11, .12); dj.add(f); }
  const lap = new THREE.Mesh(new THREE.BoxGeometry(.4, .02, .28), steel); lap.position.set(-1.9, yTop + .01, .2); dj.add(lap);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.38, .24), new THREE.MeshBasicMaterial({ color: '#5c7fb8', toneMapped: false })); scr.position.set(-1.9, yTop + .13, .34); scr.rotation.x = -.25; dj.add(scr);

  // treillis : toutes les barres en un seul InstancedMesh
  const bars = [];
  const bar = (a, b) => bars.push([a, b]);
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  function truss(a, b, size = .3, step = .45) { // poutre carrée : 4 membrures + diagonales en zigzag
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    const up = Math.abs(dir.y) > .9 ? v(1, 0, 0) : v(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(size / 2);
    const w = new THREE.Vector3().crossVectors(dir, u).normalize().multiplyScalar(size / 2);
    const corners = [u.clone().add(w), u.clone().sub(w), u.clone().negate().sub(w), u.clone().negate().add(w)];
    corners.forEach((c) => bar(a.clone().add(c), b.clone().add(c)));
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const p0 = a.clone().addScaledVector(dir, len * i / n), p1 = a.clone().addScaledVector(dir, len * (i + 1) / n);
      for (let k = 0; k < 4; k++) {
        const c0 = corners[k], c1 = corners[(k + 1) % 4];
        i % 2 ? bar(p0.clone().add(c0), p1.clone().add(c1)) : bar(p0.clone().add(c1), p1.clone().add(c0));
      }
    }
  }
  const X = 2.9, Z0 = -.9, Z1 = 1.2, HH = 3.6;
  [[-X, Z0], [X, Z0], [-X, Z1], [X, Z1]].forEach(([x, z]) => truss(v(x, 0, z), v(x, HH, z)));
  truss(v(-X, HH, Z0), v(X, HH, Z0)); truss(v(-X, HH, Z1), v(X, HH, Z1));
  truss(v(-X, HH, Z0), v(-X, HH, Z1)); truss(v(X, HH, Z0), v(X, HH, Z1));
  const barGeo = new THREE.CylinderGeometry(.018, .018, 1, 5);
  const im = new THREE.InstancedMesh(barGeo, steel, bars.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAxis = v(0, 1, 0), sc = v(1, 1, 1), mid = v(0, 0, 0);
  bars.forEach(([a, b], i) => {
    const d = b.clone().sub(a); q.setFromUnitVectors(yAxis, d.clone().normalize());
    m4.compose(mid.copy(a).add(b).multiplyScalar(.5), q, sc.set(1, d.length(), 1)); im.setMatrixAt(i, m4);
  });
  dj.add(im);
  // projecteurs accrochés au treillis, orientés vers la piste
  [-2.2, -1.1, 0, 1.1, 2.2].forEach((x) => {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, .3, 12), black); head.position.set(x, HH - .3, Z0); head.rotation.x = .9; dj.add(head);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.11, 16), new THREE.MeshBasicMaterial({ color: '#fff1d6', toneMapped: false }));
    lens.position.set(x, HH - .42, Z0 - .12); lens.rotation.x = Math.PI - .9 + Math.PI / 2; dj.add(lens);
  });
  // enceintes de part et d'autre
  [-3.5, 3.5].forEach((x) => {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.6, .7), black); sp.position.set(x, .8, 0); dj.add(sp);
    [.35, 1.0, 1.35].forEach((y, k) => { const cone = new THREE.Mesh(new THREE.CircleGeometry(k ? .12 : .24, 20), steel); cone.position.set(x, y + (k ? .05 : 0), -.352); cone.rotation.y = Math.PI; dj.add(cone); });
  });
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
    bulbSpots.push({ local: new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr), group: g, color: colors[i % 4], r: .05 });
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffcf4a', emissiveIntensity: 2.5 }));
  star.position.y = .5 + h + .2; g.add(star);

  g.position.copy(V(x, y, heightAt(x, y))); scene.add(g);
});
const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbSpots.length);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  bulbSpots.forEach((b, i) => {
    if (b.group) { b.group.updateMatrixWorld(true); b.pos = b.local.clone().applyMatrix4(b.group.matrixWorld); }
    b.base = new THREE.Color(b.color).multiplyScalar(1.6);
    m.compose(b.pos, q, sc.setScalar(b.r)); bulbs.setMatrixAt(i, m); bulbs.setColorAt(i, b.base);
  });
  scene.add(bulbs);
}
const tmpColor = new THREE.Color();
let frameNo = 0;

// tables : une banquette continue par rangée, et une petite table par emplacement
// (repère local : -z = côté banquette / dos, la table est à l'origine)
const TABLE_OBJ = new Map();
const segGeo = new THREE.BoxGeometry(.94, .4, .55);
const segBackGeo = new THREE.BoxGeometry(.94, .45, .14);
const lowGeo = new THREE.BoxGeometry(.56, .36, .5);
const lowTopGeo = new THREE.BoxGeometry(.6, .04, .54);
const LOW_MAT = new THREE.MeshStandardMaterial({ color: '#1d2235', roughness: .4, metalness: .3 });
const TOP_MAT = new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: .2, metalness: .1 }); // plateau marbre blanc
function banquette(g, mat) {
  const s = new THREE.Mesh(segGeo, mat); s.position.set(0, .2, -.55); g.add(s);
  const bk = new THREE.Mesh(segBackGeo, mat); bk.position.set(0, .55, -.86); g.add(bk);
}
TABLES.forEach((t) => {
  const g = new THREE.Group();
  const mat = M.sofa.clone(), mats = [mat];
  banquette(g, mat);
  const low = new THREE.Mesh(lowGeo, LOW_MAT); low.position.y = .18; g.add(low);
  const top = new THREE.Mesh(lowTopGeo, TOP_MAT); top.position.y = .38; g.add(top);
  const h = heightAt(t.x, t.y);
  g.position.copy(V(t.x, t.y, h));
  g.rotation.y = THREE.MathUtils.degToRad(t.rot);
  // dalle de couleur sous l'emplacement (couleur de la zone, grise si réservée)
  const zc = zoneOf(t).couleurs.at(-1);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.45), new THREE.MeshStandardMaterial({ color: zc, emissive: zc, emissiveIntensity: .3, transparent: true, opacity: .6, roughness: .6 }));
  plate.rotation.x = -Math.PI / 2; plate.position.set(0, .012, -.35); g.add(plate);
  g.traverse((o) => { if (o.isMesh) o.userData.tableId = t.id; });
  scene.add(g);
  TABLE_OBJ.set(t.id, { group: g, mats, plate, anchor: V(t.x, t.y, h + .95), base: V(t.x, t.y, h) });
});
// service à table : seau à champagne + bouteille + flûtes sur chaque table (InstancedMesh = 1 appel par type d'objet)
{
  const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const bucketGeo = lathe([[0, 0], [.085, 0], [.1, .16], [.105, .17], [0, .17]], 20);
  const iceGeo = new THREE.CylinderGeometry(.094, .094, .01, 16);
  const bottleGeo = lathe([[0, 0], [.04, 0], [.042, .02], [.042, .16], [.036, .2], [.016, .25], [.014, .31], [0, .31]], 14);
  const foilGeo = lathe([[0, 0], [.017, 0], [.017, .055], [.012, .07], [0, .07]], 10);
  const labelGeo = new THREE.CylinderGeometry(.0435, .0435, .05, 14, 1, true);
  const fluteGeo = lathe([[0, 0], [.022, 0], [.022, .004], [.003, .008], [.003, .1], [.017, .12], [.021, .18], [.022, .2]], 12);
  const wineGeo = lathe([[0, .13], [.016, .13], [.019, .17], [0, .17]], 10);
  const mats = {
    bucket: new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#f0a83a', emissiveIntensity: 1.1, roughness: .3, transparent: true, opacity: .92 }), // seau lumineux LED, comme en club
    ice: new THREE.MeshStandardMaterial({ color: '#eaf4ff', roughness: .25, transparent: true, opacity: .85 }),
    bottle: new THREE.MeshStandardMaterial({ color: '#0f2a1c', metalness: .2, roughness: .15 }),
    foil: new THREE.MeshStandardMaterial({ color: '#e8b04a', metalness: 1, roughness: .25 }),
    label: new THREE.MeshStandardMaterial({ color: '#e8b04a', metalness: .8, roughness: .3 }),
    flute: new THREE.MeshStandardMaterial({ color: '#dfeaff', metalness: .1, roughness: .05, transparent: true, opacity: .35, depthWrite: false }),
    wine: new THREE.MeshStandardMaterial({ color: '#ffd86b', emissive: '#c98a1c', emissiveIntensity: .35, roughness: .2, transparent: true, opacity: .85 }),
  };
  // positions locales sur la table basse (dessus à y = .4) : seau au centre, 4 flûtes autour
  const TOP = .4;
  const items = [
    ['bucket', bucketGeo, [[0, TOP, 0]]], ['ice', iceGeo, [[0, TOP + .165, 0]]],
    ['bottle', bottleGeo, [[0, TOP + .06, 0]], .38], ['foil', foilGeo, [[0, TOP + .06 + .245, 0]], .38], ['label', labelGeo, [[0, TOP + .06 + .09, 0]], .38],
    ['flute', fluteGeo, [[.15, TOP, .13], [-.15, TOP, .13], [.16, TOP, -.1], [-.16, TOP, -.1]]],
    ['wine', wineGeo, [[.15, TOP, .13], [-.15, TOP, .13], [.16, TOP, -.1], [-.16, TOP, -.1]]],
  ];
  const m = new THREE.Matrix4(), local = new THREE.Matrix4(), tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(.38, 0, .12));
  for (const [key, geo, spots, lean] of items) {
    const im = new THREE.InstancedMesh(geo, mats[key], TABLES.length * spots.length);
    let k = 0;
    TABLES.forEach((t) => {
      const g = TABLE_OBJ.get(t.id).group; g.updateMatrixWorld(true);
      for (const [x, y, z] of spots) {
        // la bouteille est inclinée dans le seau, comme au service
        local.compose(new THREE.Vector3(x * 1.3, TOP + (y - TOP) * 1.3, z * 1.3), lean ? tilt : new THREE.Quaternion(), new THREE.Vector3(1.3, 1.3, 1.3));
        m.multiplyMatrices(g.matrixWorld, local); im.setMatrixAt(k++, m);
      }
    });
    im.raycast = () => {}; // ne gêne pas le clic sur les tables
    scene.add(im);
  }
}

// bouts de banquette (non réservables) aux extrémités de chaque rangée, comme sur le plan
ROWS.forEach((r) => {
  const [p0, p1] = [r.pts[0], r.pts.at(-1)];
  const n = r.pts.length;
  const step = n > 1 ? [(p1[0] - p0[0]) / (n - 1), (p1[1] - p0[1]) / (n - 1)] : [16, 0];
  [[p0[0] - step[0], p0[1] - step[1]], [p1[0] + step[0], p1[1] + step[1]]].forEach(([x, y]) => {
    const g = new THREE.Group(); banquette(g, M.sofa);
    g.position.copy(V(x, y, heightAt(r.pts[0][0], r.pts[0][1]))); g.rotation.y = THREE.MathUtils.degToRad(r.rot); scene.add(g);
  });
});

// neige dans la salle
const SNOW_N = 450;
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
  b.setAttribute('aria-label', b.title);
  b.addEventListener('click', () => selectTable(t));
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
  labels.classList.toggle('compact', camera.position.distanceTo(controls.target) > 26);
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
const easeIO = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pos, target, ms = 1300, done) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms, done };
}
// vue d'ensemble adaptée à l'écran : sur un écran étroit (téléphone en vertical),
// on recule et on passe plus en vue du dessus pour que toute la salle tienne en largeur
function fitHome() {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  if (aspect >= 1.15) { HOME.pos.set(0, 40, 33); HOME.target.set(0, 0, 3); return; }
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
  const d = 22 / Math.tan(hfov / 2);
  HOME.pos.set(0, d * .93, d * .37); HOME.target.set(0, 0, 2);
}
function flyHome() { fitHome(); flyTo(HOME.pos.clone(), HOME.target.clone(), 1500); }
function flyZone(zoneId) {
  const ts = TABLES.filter((t) => t.zone === zoneId);
  const box = new THREE.Box3(); ts.forEach((t) => box.expandByPoint(TABLE_OBJ.get(t.id).anchor));
  const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
  const dist = Math.max(15, size * 1.5);
  const pos = c.clone().add(new THREE.Vector3(0, dist * .85, dist * .75));
  flyTo(pos, c, 1400);
}
// zoom cinématographique sur une table : la caméra se place derrière la table, en hauteur, regard vers la piste
function flyTable(t) {
  const o = TABLE_OBJ.get(t.id);
  const target = o.base.clone().setY(o.base.y + .3);
  const out = o.base.clone().setY(0).sub(new THREE.Vector3(0, 0, 0)).normalize(); // du centre vers la table
  if (out.lengthSq() < .01) out.set(0, 0, 1);
  const stageSide = !t.zone.startsWith('fond') && t.zone !== 'ailes'; // scène : murs bas derrière, on arrive par l'arrière
  const pos = target.clone().addScaledVector(out, stageSide ? 4.6 : -3.8).add(new THREE.Vector3(0, stageSide ? 5.8 : 6.8, 0));
  // on garde un peu l'angle courant pour une trajectoire naturelle
  flyTo(pos, target, 1500);
}
let pov = false;
function enterPov(t) {
  const o = TABLE_OBJ.get(t.id);
  const onStageT = !t.zone.startsWith('fond') && t.zone !== 'ailes';
  const eye = o.base.clone().setY(o.base.y + (onStageT ? 2.5 : 1.15)); // scène : on regarde par-dessus la cabine du DJ
  const look = V(CX, CY, .8).lerp(V(627, 566, 1.5), t.zone === 'fond1' || t.zone === 'fond2' || t.zone === 'ailes' ? .15 : 0);
  // regard depuis la table vers la piste ; on recule à peine pour voir ses propres canapés
  const dir = look.clone().sub(eye).setY(0).normalize();
  eye.addScaledVector(dir, -.9);
  pov = true; ring.visible = false;
  document.body.classList.add('pov-mode'); applyViewOffset();
  controls.enabled = false;
  flyTo(eye, look, 1800);
  $('#pov-txt').textContent = `Vue depuis la table ${t.id}`;
  $('#pov-bar').hidden = false; stage.classList.add('pov');
}
function exitPov(goHome = false) {
  if (!pov) return;
  pov = false; controls.enabled = true; $('#pov-bar').hidden = true; stage.classList.remove('pov');
  document.body.classList.remove('pov-mode'); applyViewOffset();
  if (current && !goHome) { ring.visible = true; flyTable(current); } else flyHome();
}
function zoomBy(f) {
  const d = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(d.length() * f, controls.minDistance, controls.maxDistance);
  flyTo(controls.target.clone().add(d.setLength(len)), controls.target.clone(), 450);
}
$('#zoom-in').onclick = () => zoomBy(.72);
$('#zoom-out').onclick = () => zoomBy(1.38);
$('#btn-overview').onclick = () => { exitPov(true); deselectTable(); selectZone(null); };
$('#pov-exit').onclick = () => exitPov();
controls.addEventListener('start', () => (fly = null));

// anneau de sélection doré
const ring = new THREE.Group();
{
  const m1 = new THREE.Mesh(new THREE.RingGeometry(.62, .68, 48), new THREE.MeshBasicMaterial({ color: '#f6ead0', transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  const m2 = new THREE.Mesh(new THREE.RingGeometry(.78, .81, 48), new THREE.MeshBasicMaterial({ color: '#c9a45c', transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }));
  [m1, m2].forEach((m) => { m.rotation.x = -Math.PI / 2; ring.add(m); });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, 3.5, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#e9d3a0', transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 1.75; ring.add(beam);
  ring.visible = false; scene.add(ring);
}

// clic et survol directement sur les tables 3D
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pickables = []; TABLE_OBJ.forEach((o) => o.group.traverse((m) => m.isMesh && pickables.push(m)));
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  return hit ? TABLES.find((t) => t.id === hit.object.userData.tableId) : null;
}
let down = null, hovered = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || pov) return;
  const t = pick(e); if (t) selectTable(t);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || pov) return;
  const t = pick(e);
  if (hovered && hovered !== t) highlight(hovered.id, false);
  if (t) highlight(t.id, true);
  hovered = t; canvas.style.cursor = t ? 'pointer' : '';
});

// arrivée dans la salle : survol de la caméra la première fois que le plan est visible
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
const INTRO = new THREE.Vector3(-34, 46, -38);
camera.position.copy(INTRO);
new IntersectionObserver((en, obs) => {
  if (!en[0].isIntersecting) return; obs.disconnect();
  if (current || userMoved) return; // l'utilisateur a déjà choisi une table ou bougé la vue : on ne l'interrompt pas
  fitHome(); flyTo(HOME.pos.clone(), HOME.target.clone(), 2600);
}, { threshold: .35 }).observe(stage);

/* ================================================================ boucle */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < 640 ? 55 : 42;
  camera.updateProjectionMatrix(); applyViewOffset();
}
new ResizeObserver(resize).observe(stage); resize();
const clock = new THREE.Clock();
let stageVisible = false;
new IntersectionObserver((e) => (stageVisible = e[0].isIntersecting), { rootMargin: '100px' }).observe(stage);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  if ((!stageVisible || document.hidden) && !fly) return; // rien à dessiner hors écran
  piste.rotation.y += dt * .25;
  bigStar.rotation.y += dt * .6; bigStar.position.y = 8.5 + Math.sin(t * 1.2) * .25;
  floaters.forEach((f) => (f.ball.position.y = f.h + Math.sin(t * 1.3 + f.k) * .15));
  if ((frameNo++ & 3) === 0) { // scintillement des guirlandes, 15 fois par seconde suffit
    for (let i = 0; i < bulbSpots.length; i++) bulbs.setColorAt(i, tmpColor.copy(bulbSpots[i].base).multiplyScalar(.55 + .45 * Math.sin(t * 1.6 + i * 1.7)));
    bulbs.instanceColor.needsUpdate = true;
  }
  const p = snowGeo.attributes.position;
  for (let i = 0; i < SNOW_N; i++) { let y = p.getY(i) - dt * (.6 + (i % 5) * .15); if (y < 0) y = 18; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t + i) * .003); }
  p.needsUpdate = true;
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.start) / fly.ms), e = easeIO(k);
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
    // petite courbe en hauteur pendant le trajet : mouvement plus « caméra de cinéma »
    camera.position.y += Math.sin(e * Math.PI) * fly.p0.distanceTo(fly.p1) * .08;
    if (k === 1) { const d = fly.done; fly = null; d && d(); }
  }
  if (ring.visible) { const s = 1 + Math.sin(t * 3) * .05; ring.scale.set(s, 1, s); ring.rotation.y += dt * .4; }
  if (pov) camera.lookAt(controls.target); else controls.update();
  renderer.render(scene, camera);
  placeLabels();
});
$('#loading').remove();
{
  const hint = $('.hint');
  if (matchMedia('(pointer: coarse)').matches) hint.textContent = 'Glissez pour tourner · Pincez pour zoomer · Touchez une table';
  const hide = () => hint.classList.add('gone');
  canvas.addEventListener('pointerdown', hide, { once: true });
  setTimeout(hide, 9000);
}
// le bouton de l'accueil devient actif quand la salle est prête
requestAnimationFrame(() => { const c = $('#cta-main'); c.classList.remove('loading'); c.querySelector('.cta-txt').textContent = 'Choisir ma table'; c.insertAdjacentHTML('beforeend', '<span class="arrow">→</span>'); });

/* ================================================================ zones */
let activeZone = null;
let current = null;
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
  if (current && current.zone !== id) deselectTable();
  renderZones(); refreshLabels(); renderStrip();
  id ? flyZone(id) : flyHome();
  if (id && innerWidth <= 1100) scrollToEl(stage, -80);
}
function refreshLabels() {
  const only = $('#only-free').checked;
  for (const t of TABLES) {
    const b = LABEL.get(t.id), taken = reserved.has(t.id);
    b.classList.toggle('taken', taken);
    b.setAttribute('aria-label', `Table ${t.id}, ${zoneOf(t).nom}, ${euros(prixTable(t))}, ${taken ? 'réservée' : 'disponible'}`);
    b.classList.toggle('hide', only && taken);
    b.classList.toggle('dim', !!activeZone && t.zone !== activeZone);
    const o = TABLE_OBJ.get(t.id);
    o.mats.forEach((m) => m.color.set(taken ? '#3a3234' : '#e6dccb'));
    o.plate.material.color.set(taken ? '#3a3234' : zoneOf(t).couleurs.at(-1));
    o.plate.material.emissiveIntensity = taken ? 0 : .25;
  }
  renderStrip();
}

/* ================================================================ sélection d'une table */
function selectTable(t) {
  exitPov(true);
  current = t;
  activeZone = t.zone;
  LABEL.forEach((b) => b.classList.remove('sel')); LABEL.get(t.id).classList.add('sel');
  const o = TABLE_OBJ.get(t.id);
  ring.position.copy(o.base).setY(o.base.y + .03);
  ring.scale.set(.2, 1, .2); ring.visible = true;
  const z = zoneOf(t), prix = prixTable(t), taken = reserved.has(t.id);
  const badge = $('#badge'); badge.textContent = `Table ${t.id} · ${euros(prix)}`; badge.hidden = false;
  badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
  $('#tp-title').textContent = `Table ${t.id}`;
  $('#tp-zone').textContent = `${z.nom} · ${z.desc}`;
  $('#tp-price').textContent = euros(prix);
  $('#tp-sub').textContent = `Prix total de la table · jusqu’à ${z.capacite} personnes · acompte ${EVENT.acomptePct} % : ${euros(Math.round(prix * EVENT.acomptePct / 100))}`;
  $('#tp-status').className = 'tp-status ' + (taken ? 'taken' : 'free');
  $('#tp-status').innerHTML = taken ? '<strong>Réservée</strong>Choisissez une autre table sur le plan ou dans la liste.' : '<strong>Disponible</strong>Envoyez votre demande : l’organisation vous recontacte rapidement.';
  $('#tp-ask').disabled = taken;
  const side = $('#side'); side.classList.add('closed', 'has-table'); $('#collapse').textContent = '+';
  const panel = $('#tpanel'); panel.hidden = false; panel.classList.remove('enter'); void panel.offsetWidth; panel.classList.add('enter');
  renderZones(); refreshLabels();
  flyTable(t);
  if (isSheet()) { document.body.classList.add('sheet-open'); scrollToEl(stage, -64); }
  applyViewOffset();
}
// mobile / tablette : la fiche de la table s'ouvre en panneau bas, le plan reste visible au-dessus
function isSheet() { return innerWidth <= 1100; }
function applyViewOffset() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (isSheet() && document.body.classList.contains('sheet-open') && !document.body.classList.contains('pov-mode')) camera.setViewOffset(w, h, 0, h * .2, w, h);
  else camera.clearViewOffset();
}
addEventListener('resize', applyViewOffset, { passive: true });
function deselectTable() {
  current = null; ring.visible = false; $('#badge').hidden = true; $('#tpanel').hidden = true;
  document.body.classList.remove('sheet-open'); applyViewOffset();
  const side = $('#side'); side.classList.remove('closed', 'has-table'); $('#collapse').textContent = '−';
  LABEL.forEach((b) => b.classList.remove('sel'));
}
function renderStrip() {
  const el = $('#zone-strip');
  if (!activeZone) { el.hidden = true; return; }
  const z = ZONES.find((x) => x.id === activeZone), ts = TABLES.filter((t) => t.zone === activeZone);
  const fmt = (p) => (Array.isArray(p) ? `${euros(p[0])} – ${euros(p[1])}` : euros(p));
  $('#zs-name').textContent = z.nom;
  $('#zs-meta').textContent = `${ts.length} tables · ${fmt(z.prix)}`;
  $('#zs-list').innerHTML = ts.map((t) => {
    const taken = reserved.has(t.id);
    return `<button type="button" class="zs-card ${taken ? 'taken' : ''} ${current && current.id === t.id ? 'sel' : ''}" data-id="${t.id}" style="--zc:${z.couleurs.at(-1)}">
      <b>Table ${t.id}</b><span>${euros(prixTable(t))}</span><small>${taken ? 'Réservée' : 'Disponible'}</small></button>`;
  }).join('');
  $('#zs-list').querySelectorAll('button').forEach((b) => (b.onclick = () => selectTable(TABLES.find((t) => t.id === b.dataset.id))));
  el.hidden = false;
}
{
  let y0 = null;
  $('#tpanel').addEventListener('touchstart', (e) => { if ($('#tpanel').scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  $('#tpanel').addEventListener('touchend', (e) => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 70) $('#tp-close').click(); y0 = null; }, { passive: true });
}
$('#tp-close').onclick = () => { exitPov(true); deselectTable(); selectZone(activeZone); };
$('#tp-pov').onclick = () => current && enterPov(current);
$('#tp-ask').onclick = () => current && openDrawer(current);
$('#only-free').onchange = refreshLabels;
const toggleZones = () => { const c = $('#side').classList.toggle('closed'); $('#collapse').textContent = c ? '+' : '−'; };
$('#collapse').onclick = (e) => { e.stopPropagation(); toggleZones(); };
$('.side-head').onclick = toggleZones;

/* ================================================================ fiche table + formulaire */
const drawer = $('#drawer'), back = $('#drawer-back'), form = $('#form');
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
  lastFocus = document.activeElement;
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); back.hidden = false;
  setTimeout(() => (taken ? $('#drawer-close') : form.prenom).focus({ preventScroll: true }), 350);
}
let lastFocus = null;
function closeDrawer() {
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); back.hidden = true;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
// la touche Tab reste dans le formulaire tant qu'il est ouvert
drawer.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const f = [...drawer.querySelectorAll('button, input:not(.hp), select, textarea, a[href]')].filter((x) => x.offsetParent !== null && !x.disabled);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
  else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
});
$('#drawer-close').onclick = closeDrawer; back.onclick = closeDrawer; $('#d-ok-close').onclick = closeDrawer;
addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (drawer.classList.contains('open')) closeDrawer(); else if (pov) exitPov(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#d-error'); err.hidden = true;
  const f = Object.fromEntries(new FormData(form));
  const problems = [];
  if (!f.prenom.trim() || !f.nom.trim()) problems.push('indiquez votre prénom et votre nom');
  if (f.tel.replace(/\D/g, '').length < 8) problems.push('indiquez un numéro de téléphone valide');
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) problems.push('l’e-mail semble incorrect');
  if (!f.cgv) problems.push('cochez la case concernant l’acompte');
  const bad = { prenom: !f.prenom.trim(), nom: !f.nom.trim(), tel: f.tel.replace(/\D/g, '').length < 8, email: !!f.email && !/^\S+@\S+\.\S+$/.test(f.email), cgv: !f.cgv };
  Object.entries(bad).forEach(([k, v]) => form[k].setAttribute('aria-invalid', v ? 'true' : 'false'));
  if (problems.length) { err.textContent = 'Merci de vérifier : ' + problems.join(', ') + '.'; err.hidden = false; form[Object.keys(bad).find((k) => bad[k])].focus(); return; }
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
