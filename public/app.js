import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { EVENT, ZONES, GROUPES, VIP_NOM, MAX_PAR_DEMANDE, TABLES, SALONS, zoneOf, ligneById, groupeOf, tablesDe, placesDe, euros, enVente, totalLigne, acompteLigne, prixLabel } from './config.js';
import * as PLAN from './plan.js';

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
if ($('#meta-count')) $('#meta-count').textContent = `${VIP_NOM} · 4 zones · lignes avant et arrière`;

/* ================================================================ état (toujours le serveur, jamais de simulation locale) */
let reserved = new Set();
let restants = {};
let stateOk = false;
const restant = (id) => (id in restants ? restants[id] : placesDe(id));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchTimeout(url, opts = {}, ms = 15000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}
// lecture des disponibilités, avec 3 essais espacés ; en cas d'échec on l'indique, on n'invente rien
async function loadState() {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchTimeout('api/state', { cache: 'no-store' }, 8000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!Array.isArray(j.reserved) || typeof j.restant !== 'object') throw new Error('réponse incomplète');
      reserved = new Set(j.reserved); restants = j.restant; stateOk = true;
      $('#net-warn')?.setAttribute('hidden', '');
      return true;
    } catch { await wait(800 * 2 ** i); }
  }
  stateOk = false; $('#net-warn')?.removeAttribute('hidden');
  return false;
}
// Envoi d'une demande. Succès UNIQUEMENT si le serveur confirme avec un numéro de demande.
// Le serveur ignore les doublons (même téléphone, même ligne, 30 min) : réessayer est donc sans risque.
async function submitDemande(data) {
  let r;
  try {
    r = await fetchTimeout('api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }, 15000);
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'Le serveur n’a pas confirmé la réception de votre demande. Réessayez : si elle était déjà arrivée, elle ne sera pas enregistrée deux fois.'
      : 'Connexion impossible : votre demande n’a pas été envoyée. Vérifiez votre connexion internet puis réessayez.');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || 'Envoi impossible pour le moment. Réessayez dans un instant.');
  if (!j || j.ok !== true || typeof j.id !== 'string' || !j.id) throw new Error('Réponse du serveur incomplète : votre demande n’est pas confirmée. Réessayez.');
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
setTimeout(() => { const i = $('#intro'); if (i) i.hidden = true; }, document.documentElement.classList.contains('quick') ? 1200 : 2100);
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
const scrollToEl = (el, offset = 0) => {
  if (lenis) return lenis.scrollTo(el, { offset, duration: 1.2 });
  scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: reduceMotion ? 'auto' : 'smooth' });
};
const sousEntete = () => -((document.querySelector('.topbar')?.offsetHeight || 0) + 8);

// deux pages : l'accueil, puis le plan (ouvert par « Choisir ma table »)
const body = document.body;
const chargerImagesPlan = () => $$('img[data-src]').forEach((i) => { i.src = i.dataset.src; delete i.dataset.src; });
function showView(v, animate = true) {
  if (body.dataset.view === v) return;
  const go = () => {
    body.dataset.view = v;
    if (lenis) lenis.scrollTo(0, { immediate: true }); else scrollTo(0, 0);
    body.classList.remove('leaving');
    if (animate && !reduceMotion) { body.classList.add('entering'); setTimeout(() => body.classList.remove('entering'), 1100); }
    if (v === 'plan') { chargerImagesPlan(); lenis && lenis.start(); dispatchEvent(new Event('resize')); } else lenis && lenis.stop();
  };
  if (animate && !reduceMotion && v === 'plan') { body.classList.add('leaving'); setTimeout(go, 650); } else go();
}
$$('a[href="#reserver"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (a.classList.contains('loading')) return; history.pushState({ v: 'plan' }, '', '#plan'); showView('plan'); }));
$$('a[href="#accueil"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); history.pushState({ v: 'hero' }, '', location.pathname); showView('hero'); }));
addEventListener('popstate', () => {
  if (drawerOuvert()) { closeDrawer(true); if (location.hash === '#plan') return; }
  showView(location.hash === '#plan' ? 'plan' : 'hero');
});
const drawerOuvert = () => document.querySelector('#drawer')?.classList.contains('open');
body.dataset.view = location.hash === '#plan' ? 'plan' : 'hero';
if (body.dataset.view === 'plan') chargerImagesPlan();

/* ================================================================ scène 3D */
// plan Deco Flamme : coordonnées en mètres, origine au centre de la piste (voir plan.js)
const DESSUS = new URLSearchParams(location.search).has('dessus'); // vue de contrôle
const PX = 1;
const CX = 0, CY = 0;
const V = (x, y, h = 0) => new THREE.Vector3((x - CX) / PX, h, (y - CY) / PX);
const shapeFrom = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - CX) / PX, -(y - CY) / PX)));

const canvas = $('#scene');
const stage = $('#stage');
let renderer, sansGL = false;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch {
  // appareil sans 3D : on garde toute la logique de réservation, sans dessiner la salle
  sansGL = true; stage.classList.add('no-gl');
  renderer = { setPixelRatio() {}, setSize() {}, setClearColor() {}, render() {}, setAnimationLoop() {}, domElement: canvas };
  stage.insertAdjacentHTML('beforeend', '<p class="no-gl-msg">Le plan 3D ne peut pas s’afficher sur cet appareil. Choisissez votre zone dans la liste ci-dessous.</p>');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a1430');
scene.fog = new THREE.Fog('#0a1430', 110, 230);

const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
const HOME = { pos: new THREE.Vector3(0, 47, 38), target: new THREE.Vector3(0, 0, 1.5) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.zoomToCursor = true;
controls.minDistance = 3.5;
controls.maxDistance = 170;
controls.maxPolarAngle = 1.32;
controls.screenSpacePanning = false;

// lumières : ambiance chaude de salle de bal + touches de couleur de Noël
scene.add(new THREE.HemisphereLight('#fff1dc', '#3a2a40', 1.7));
const sun = new THREE.DirectionalLight('#ffd9a3', 1.5); sun.position.set(-20, 40, 25); scene.add(sun);
[[-15, 9, -3, '#ffb877'], [15, 9, -3, '#ffb877']].forEach(([x, y, z, c]) => { // 2 lumières seulement : chacune coûte sur chaque pixel
  const l = new THREE.PointLight(c, 210, 56, 1.6); l.position.set(x, y, z); scene.add(l);
});

// textures procédurales
function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4; return t;
}
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
  floor: new THREE.MeshStandardMaterial({ color: '#16213d', roughness: .6, metalness: .1 }), // sol uni
  carpet: new THREE.MeshStandardMaterial({ color: '#4a0c18', roughness: .9 }), // estrades unies
  gold: new THREE.MeshStandardMaterial({ color: '#c9a25a', roughness: .35, metalness: .85 }),
  wall: new THREE.MeshStandardMaterial({ color: '#2e0b13', roughness: .55 }),
  wallLow: new THREE.MeshStandardMaterial({ color: '#24090f', roughness: .6 }),
  snow: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#5a3418', roughness: .9 }),
  window: null, // défini plus bas (texture de niche dorée)
  sofa: new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: .9 }),
  table: new THREE.MeshStandardMaterial({ color: '#c9a25a', roughness: .3, metalness: .8 }),
  dark: new THREE.MeshStandardMaterial({ color: '#141414', roughness: .6 }),
  bar: new THREE.MeshStandardMaterial({ color: '#d8c08c', roughness: .5, metalness: .2 }),
  barTop: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: .3, metalness: .3 }),
  tree: new THREE.MeshStandardMaterial({ color: '#173a2b', roughness: .85 }),
};

// niche murale : arche fine dorée, fond velours, halo chaud en bas (remplace les aplats jaunes)
M.window = new THREE.MeshStandardMaterial({ transparent: true, roughness: .6, emissive: '#ffffff', emissiveIntensity: .9, map: canvasTex(256, 512, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  const arche = () => { c.beginPath(); c.moveTo(18, h - 10); c.lineTo(18, w / 2 + 10); c.arc(w / 2, w / 2 + 10, w / 2 - 18, Math.PI, 0); c.lineTo(w - 18, h - 10); c.closePath(); };
  arche(); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a0910'); g.addColorStop(.7, '#4a1418'); g.addColorStop(1, '#b8682a'); c.fillStyle = g; c.fill();
  c.lineWidth = 7; c.strokeStyle = '#d4a64a'; arche(); c.stroke();
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,220,150,.6)'; c.beginPath(); c.arc(w / 2, w / 2 + 10, w / 2 - 34, Math.PI, 0); c.stroke();
}) });
M.window.emissiveMap = M.window.map;
// toutes les ampoules (murs + sapins) sont dessinées en un seul appel (InstancedMesh)
const bulbSpots = [];
const BULB_COLORS = ['#ffe3a8', '#fff1d6', '#ffd889', '#fff1d6'];

// sol de la salle (contour relevé sur le plan Deco Flamme)
const ROOM = PLAN.ROOM;
{
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(ROOM)), M.floor);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // grand sol extérieur sombre
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: '#0c1730' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; scene.add(ground);
}
// murs : hauts au fond (côté VIP), bas côté entrée/scène pour garder la vue
// le tracé du plan est la FACE INTÉRIEURE des murs : murs, rambardes et colonnes sont repoussés vers l'extérieur
const ROOM_SENS = ROOM.reduce((s, p, i) => { const q = ROOM[(i + 1) % ROOM.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
const versInterieur = (p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [-dz / l * ROOM_SENS, dx / l * ROOM_SENS]; };
ROOM.forEach((p, i) => {
  const q = ROOM[(i + 1) % ROOM.length];
  const nIn = versInterieur(p, q);
  const a = V(...p), b = V(...q);
  const len = a.distanceTo(b);
  const back = (p[1] + q[1]) / 2 < 1; // fond et côtés VIP : murs hauts ; côté scène et foyers : murets
  const h = back ? 6 : 1.4;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, .35), back ? M.wall : M.wallLow);
  wall.position.copy(a).lerp(b, .5); wall.position.y = h / 2;
  wall.position.x -= nIn[0] * .175; wall.position.z -= nIn[1] * .175;
  wall.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  scene.add(wall);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .42), M.gold);
  rail.position.copy(wall.position); rail.position.y = h; rail.rotation.y = wall.rotation.y; scene.add(rail);
  // guirlande lumineuse le long du mur
  const nb = Math.floor(len / .9);
  for (let k = 0; k < nb; k++) {
    const o = new THREE.Object3D();
    o.position.copy(a).lerp(b, (k + .5) / nb); o.position.y = h - .35 - Math.sin(((k + .5) / nb * len / 1.8) % 1 * Math.PI) * .35;
    o.position.x += nIn[0] * .08; o.position.z += nIn[1] * .08;
    bulbSpots.push({ pos: o.position.clone(), color: BULB_COLORS[k % 4], r: .06 });
  }
  if (back) {
    // arcades lumineuses
    const n = Math.max(1, Math.floor(len / 3.2));
    for (let k = 0; k < n; k++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3), M.window);
      win.position.copy(a).lerp(b, (k + .5) / n); win.position.y = 2.6;
      win.position.x += nIn[0] * .02; win.position.z += nIn[1] * .02;
      win.rotation.y = wall.rotation.y + (ROOM_SENS > 0 ? 0 : Math.PI); scene.add(win);
    }
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.35, .4, back ? 6.6 : 1.8, 16), M.gold);
  const nPrec = versInterieur(ROOM[(i - 1 + ROOM.length) % ROOM.length], p);
  col.position.copy(a); col.position.x -= (nIn[0] + nPrec[0]) * .25; col.position.z -= (nIn[1] + nPrec[1]) * .25; col.position.y = (back ? 6.6 : 1.8) / 2; scene.add(col);
});

// estrades VIP +0,60
const H = .6;
const PLATFORMS = PLAN.PLATFORMS; // zones 1 à 4 et scène
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const heightAt = (x, y) => (PLATFORMS.some((p) => inPoly(x, y, p)) ? H : 0);
PLATFORMS.forEach((pts) => {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: H, bevelEnabled: false });
  const m = new THREE.Mesh(geo, [M.carpet, M.gold]);
  m.rotation.x = -Math.PI / 2; scene.add(m);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#f0d08a' }));
  edge.rotation.x = -Math.PI / 2; scene.add(edge);
});

// piste tournante Ø 7,50 m
const piste = new THREE.Mesh(new THREE.CylinderGeometry(3.75, 3.75, .14, 64), [new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: .8, roughness: .3 }), new THREE.MeshStandardMaterial({ map: pisteTex, roughness: .35, metalness: .3 }), M.dark]);
piste.position.copy(V(CX, CY, .07)); scene.add(piste);
const pisteRing = new THREE.Mesh(new THREE.TorusGeometry(3.85, .06, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
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
[[-3, -1.5, 7, '#e8b04a'], [3, -1.5, 6.6, '#5c7fb8'], [-2.5, 3, 6.2, '#f4f6fb'], [2.5, 3, 7.2, '#e8b04a'], [-6, 1, 7.5, '#7a1424'], [6, 1, 7, '#5c7fb8']].forEach(([x, y, h, c], k) => {
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
  // régie 4 × 2 m à l'avant de la scène, face à la piste, sur son estrade
  const riser = new THREE.Mesh(new THREE.BoxGeometry(4.4, H, 2.4), [M.gold, M.gold, M.carpet, M.gold, M.gold, M.gold]);
  riser.position.copy(V(PLAN.DJ[0], PLAN.DJ[1], H / 2)); scene.add(riser);
  dj.position.copy(V(PLAN.DJ[0], PLAN.DJ[1], H)); scene.add(dj);
}

// faisceaux lumineux partant du treillis du DJ et balayant la piste
const FAISCEAUX = [];
{
  const geo = new THREE.ConeGeometry(1.6, 15, 24, 1, true).translate(0, -7.5, 0); // pointe en haut, à l'origine
  const couleurs = ['#ffd27a', '#9fd0ff', '#ffd27a', '#ff9fb8', '#9fd0ff', '#ffd27a'];
  couleurs.forEach((c, k) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(V(PLAN.DJ[0] - 2.2 + k * .88, PLAN.DJ[1] - .9, H + 3.6)); m.raycast = () => {}; scene.add(m);
    FAISCEAUX.push({ m, k });
  });
}

// bars : comptoir en U de 5,30 × 3 m (ouvert vers l'extérieur de la salle) et arrière-bar de 2 × 0,5 m au centre.
// Façade noire + plateau marbre, bande LED, étagères de bouteilles éclairées,
// suspensions au-dessus du comptoir et enseigne « BAR ».
{
  const facade = new THREE.MeshStandardMaterial({ color: '#15151b', roughness: .45, metalness: .35 });
  const marbre = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: .18, metalness: .05 });
  const laiton = new THREE.MeshStandardMaterial({ color: '#d4a64a', roughness: .3, metalness: .9 });
  const led = new THREE.MeshBasicMaterial({ color: '#ffcf7a', toneMapped: false });
  const fond = new THREE.MeshStandardMaterial({ color: '#2a1608', emissive: '#ff9d3a', emissiveIntensity: .55, roughness: .6 });
  const enseigne = canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d4a64a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#ffd27a'; c.font = '700 104px Archivo, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BAR', w / 2, h / 2 + 6);
  });
  const enseigneMat = new THREE.MeshBasicMaterial({ map: enseigne, toneMapped: false });
  const bottles = [], pendants = [];
  const BOTTLE_COLORS = ['#1f5a3a', '#6b3a12', '#d9d2c0', '#2c3d6b', '#7a1424', '#c99a2e'].map((c) => new THREE.Color(c));
  PLAN.BARS.forEach(({ x, z, a, cote }) => {
    const g = new THREE.Group();
    const L = 5.3, W = 3, E = .6, HB = 1.1;
    const comptoir = (w, d, px, pz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, HB - .05, d), facade); b.position.set(px, (HB - .05) / 2, pz); g.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(w + .24, .06, d + .24), marbre); t.position.set(px, HB, pz); g.add(t); // plateau qui déborde côté clients
      const r = new THREE.Mesh(new THREE.BoxGeometry(w + .02, .03, d + .02), led); r.position.set(px, .06, pz); g.add(r);    // LED au pied
      const p = new THREE.Mesh(new THREE.BoxGeometry(w + .04, .035, d + .04), laiton); p.position.set(px, .28, pz); g.add(p); // repose-pieds laiton
    };
    comptoir(L, E, 0, -(W - E) / 2); comptoir(L, E, 0, (W - E) / 2); comptoir(E, W - 2 * E, cote * (L - E) / 2, 0);
    // arrière-bar : meuble bas, deux faces d'étagères éclairées, enseigne au-dessus
    const meuble = new THREE.Mesh(new THREE.BoxGeometry(2, .95, .5), facade); meuble.position.y = .475; g.add(meuble);
    const vitrine = new THREE.Mesh(new THREE.BoxGeometry(2, 1.15, .36), fond); vitrine.position.y = .95 + .575; g.add(vitrine);
    for (const y of [1.08, 1.46, 1.84]) {
      const et = new THREE.Mesh(new THREE.BoxGeometry(2.02, .03, .5), laiton); et.position.y = y - .02; g.add(et);
      for (const face of [-1, 1]) for (let k = 0; k < 9; k++) bottles.push({ g, p: new THREE.Vector3(-.88 + k * .22, y, face * .2), c: BOTTLE_COLORS[(k * 7 + Math.round(y * 10) + (face > 0 ? 2 : 0)) % BOTTLE_COLORS.length] });
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.06, .05, .52), laiton); top.position.y = 2.12; g.add(top);
    for (const face of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .5), enseigneMat); sign.position.set(0, 2.5, face * .02); if (face < 0) sign.rotation.y = Math.PI; g.add(sign);
    }
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(1.64, .54, .03), facade); signBack.position.y = 2.5; g.add(signBack);
    // suspensions au-dessus du comptoir (pas de tabourets)
    for (const sz of [-1, 1]) for (let k = 0; k < 4; k++) pendants.push({ g, p: new THREE.Vector3(-1.8 + k * 1.2, 2.55, sz * (W - E) / 2) });
    g.position.copy(V(x, z)); g.rotation.y = -THREE.MathUtils.degToRad(a); scene.add(g); g.updateMatrixWorld(true);
  });
  const inst = (geo, mat, list, colors) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    list.forEach((o, i) => { im.setMatrixAt(i, m.compose(o.p, q, one).premultiply(o.g.matrixWorld)); if (colors) im.setColorAt(i, o.c); });
    im.raycast = () => {}; scene.add(im);
  };
  const bottleGeo = new THREE.LatheGeometry([[0, 0], [.035, 0], [.036, .17], [.014, .23], [.012, .29], [0, .29]].map(([u, v]) => new THREE.Vector2(u, v)), 10);
  inst(bottleGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .15, metalness: .2, emissive: '#3a2410', emissiveIntensity: .4 }), bottles, true);
  inst(new THREE.SphereGeometry(.075, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }), pendants);
  inst(new THREE.CylinderGeometry(.006, .006, 1.4, 4).translate(0, .75, 0), laiton, pendants);
}

// deux sapins de Noël 4 m, hors des zones du plan (près des bars) avec guirlandes clignotantes
[[-23, 2.5, 4], [23, 2.5, 4]].forEach(([x, y, h]) => {
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

// salons : banquettes le long du tracé du plan (dossier du côté opposé aux tables),
// loges rondes de la scène, et une table basse par emplacement
const TABLE_OBJ = new Map();
const lowGeo = new THREE.BoxGeometry(.64, .36, .64); // tables du plan : carrés d'environ 0,75 m
const lowTopGeo = new THREE.BoxGeometry(.72, .04, .72);
const roundGeo = new THREE.CylinderGeometry(.42, .42, .5, 28);
const roundTopGeo = new THREE.CylinderGeometry(.48, .48, .04, 32);
const LOW_MAT = new THREE.MeshStandardMaterial({ color: '#1d2235', roughness: .4, metalness: .3 });
const TOP_MAT = new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: .2, metalness: .1 }); // plateau marbre blanc
// une matière par ligne (surbrillance d'une ligne entière) ; banquettes et tables dessinées en InstancedMesh
// pour garder peu d'appels de dessin, même sur un petit téléphone
const LINE_MAT = new Map(ZONES.map((l) => [l.id, M.sofa.clone()]));
const PLATE_MAT = new Map(ZONES.map((l) => { const c = l.couleurs.at(-1); return [l.id, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .3, transparent: true, opacity: .6, roughness: .6 })]; }));
const plateCarre = new THREE.PlaneGeometry(.82, .82), plateRond = new THREE.CircleGeometry(.62, 32); // dalle à peine plus grande que la table : ne passe pas sous les canapés
const SOFA_BOX = new Map(); // ligne → [{ m: Matrix4, id }]
const TABLE_INST = { carre: [], rond: [] }; // { m, id }
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const boxAt = (ligne, id, pos, rot, sx, sy, sz) => { (SOFA_BOX.get(ligne) || SOFA_BOX.set(ligne, []).get(ligne)).push({ m: new THREE.Matrix4().compose(pos, _q.setFromAxisAngle(_up, rot).clone(), new THREE.Vector3(sx, sy, sz)), id }); };
function arc(cx, cz, r, a0, a1, n) { const pts = []; for (let i = 0; i <= n; i++) { const a = THREE.MathUtils.degToRad(a0 + (a1 - a0) * i / n); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return pts; }
SALONS.forEach((s, si) => {
  const ts = TABLES.filter((t) => t.salon === si);
  const mat = LINE_MAT.get(s.ligne);
  if (s.type === 'salon' && s.ligne !== 'scene') {
    // zones VIP : canapés modulaires relevés module par module sur le PDF (plan.js → SOFAS)
    for (const [x, z, w, d, a, backs, li] of PLAN.SOFAS) {
      if (li !== si) continue;
      const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux, h = heightAt(x, z);
      const at = (ox, oz, y) => V(x + ox * ux + oz * vx, z + ox * uz + oz * vz, h + y);
      boxAt(s.ligne, ts[0].id, at(0, 0, .2), -a, w - .03, .4, d - .03); // assise
      const T = .16;
      if (backs & 1) boxAt(s.ligne, ts[0].id, at(w / 2 - T / 2, 0, .62), -a, T, .44, d - .03);
      if (backs & 2) boxAt(s.ligne, ts[0].id, at(-w / 2 + T / 2, 0, .62), -a, T, .44, d - .03);
      if (backs & 4) boxAt(s.ligne, ts[0].id, at(0, d / 2 - T / 2, .62), -a, w - .03, .44, T);
      if (backs & 8) boxAt(s.ligne, ts[0].id, at(0, -d / 2 + T / 2, .62), -a, w - .03, .44, T);
    }
  } else {
    // loges rondes et banquettes de la scène : tracé du plan, profondeur 0,65 m dossier compris
    const pts = s.type === 'loge' ? arc(s.tables[0][0], s.tables[0][1], 1.05, 5, 175, 6) : s.sofa;
    const cx = s.tables.reduce((q, p) => q + p[0], 0) / s.tables.length, cz = s.tables.reduce((q, p) => q + p[1], 0) / s.tables.length;
    const ext = s.type === 'loge' ? .12 : 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let nx = -(bz - az) / len, nz = (bx - ax) / len;
      if (nx * (cx - mx) + nz * (cz - mz) > 0) { nx = -nx; nz = -nz; } // dossier vers l'extérieur du salon
      const h = heightAt(mx, mz), rot = -Math.atan2(bz - az, bx - ax);
      boxAt(s.ligne, ts[0].id, V(mx, mz, h + .2), rot, len + ext, .4, .65); // assise
      boxAt(s.ligne, ts[0].id, V(mx + nx * .245, mz + nz * .245, h + .62), rot, len + ext, .44, .16); // dossier
    }
  }
  // orientation des tables : celle du module de canapé le plus proche (VIP) ou de la banquette (scène)
  let rot = 0, best = 0;
  if (s.sofa) for (let i = 0; i < s.sofa.length - 1; i++) { const dx = s.sofa[i + 1][0] - s.sofa[i][0], dz = s.sofa[i + 1][1] - s.sofa[i][1], l = Math.hypot(dx, dz); if (l > best) { best = l; rot = -Math.atan2(dz, dx); } }
  const rotDe = (t) => { let r = rot, dm = Infinity; for (const m of PLAN.SOFAS) if (m[6] === si) { const dd = Math.hypot(m[0] - t.x, m[1] - t.y); if (dd < dm) { dm = dd; r = -m[4]; } } return r; };
  ts.forEach((t) => {
    const g = new THREE.Group();
    const h = heightAt(t.x, t.y);
    g.position.copy(V(t.x, t.y, h)); g.rotation.y = s.ligne !== 'scene' ? rotDe(t) : rot;
    // dalle de couleur sous l'emplacement (matière de la ligne)
    const plate = new THREE.Mesh(t.rond ? plateRond : plateCarre, PLATE_MAT.get(t.zone));
    plate.rotation.x = -Math.PI / 2; plate.position.y = .012; plate.userData.tableId = t.id; g.add(plate);
    scene.add(g); g.updateMatrixWorld(true);
    TABLE_INST[t.rond ? 'rond' : 'carre'].push({ m: g.matrixWorld.clone(), id: t.id });
    TABLE_OBJ.set(t.id, { group: g, mats: [mat], plate, anchor: V(t.x, t.y, h + .95), base: V(t.x, t.y, h), top: t.rond ? .54 : .4 });
  });
});
const INST_PICK = [];
{
  const make = (geo, mat, list, local) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4();
    list.forEach((b, i) => im.setMatrixAt(i, local ? m.multiplyMatrices(b.m, local) : b.m));
    im.userData.ids = list.map((b) => b.id); scene.add(im); INST_PICK.push(im); return im;
  };
  SOFA_BOX.forEach((list, ligne) => make(unitBox, LINE_MAT.get(ligne), list));
  const up = (y) => new THREE.Matrix4().makeTranslation(0, y, 0);
  make(lowGeo, LOW_MAT, TABLE_INST.carre, up(.18)); make(lowTopGeo, TOP_MAT, TABLE_INST.carre, up(.38));
  make(roundGeo, LOW_MAT, TABLE_INST.rond, up(.25)); make(roundTopGeo, TOP_MAT, TABLE_INST.rond, up(.52));
}
// service à table façon club : CHAQUE table a sa vasque (bac ovale transparent, glace pilée, liseré LED bleu)
// garnie de bouteilles inclinées — vodka givrée, champagne, whisky — avec des fontaines (sparklers) dorées,
// et 4 verres autour. Mélange différent d'une table à l'autre. Tout en InstancedMesh (1 appel par type d'objet) ;
// chaque pièce d'une bouteille (capsule, étiquette, sparkler) est posée dans le repère de SA bouteille.
const ETINCELLES = [], SERVICE = new THREE.Group(); scene.add(SERVICE);
{
  const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const ovale = (g) => g.scale(1.5, 1, 1);
  const G = {
    vasque: ovale(lathe([[0, 0], [.11, 0], [.15, .1], [.165, .19], [.16, .195]], 20)),
    glace: ovale(new THREE.CylinderGeometry(.155, .12, .13, 16).translate(0, .065, 0)),
    led: ovale(new THREE.TorusGeometry(.163, .006, 4, 28).rotateX(Math.PI / 2).translate(0, .193, 0)),
    vodka: lathe([[0, 0], [.036, 0], [.038, .015], [.038, .22], [.028, .25], [.014, .27], [.014, .31], [0, .31]], 8),
    vodkaCap: new THREE.CylinderGeometry(.016, .016, .05, 10).translate(0, .325, 0),
    vodkaBande: new THREE.CylinderGeometry(.0385, .0385, .035, 8, 1, true).translate(0, .12, 0),
    champ: lathe([[0, 0], [.038, 0], [.04, .02], [.04, .16], [.034, .2], [.015, .25], [.013, .3], [0, .3]], 8),
    foil: lathe([[0, 0], [.017, 0], [.017, .06], [.012, .075], [0, .075]], 6).translate(0, .235, 0),
    champLabel: new THREE.CylinderGeometry(.0405, .0405, .055, 8, 1, true).translate(0, .09, 0),
    whisky: new THREE.BoxGeometry(.075, .19, .055).translate(0, .095, 0),
    whiskyNeck: lathe([[0, 0], [.018, 0], [.015, .05], [.015, .075], [0, .075]], 6).translate(0, .19, 0),
    whiskyLabel: new THREE.BoxGeometry(.077, .07, .057).translate(0, .09, 0),
    sparkler: new THREE.CylinderGeometry(.009, .009, .2, 6).translate(0, .1, 0),
    etincelle: new THREE.SphereGeometry(.03, 8, 6),
    verre: lathe([[0, 0], [.03, 0], [.033, .1], [0, .1]], 8),
    boisson: lathe([[0, .004], [.028, .004], [.03, .07], [0, .07]], 8),
  };
  const MAT = {
    vasque: new THREE.MeshStandardMaterial({ color: '#dfeaff', roughness: .05, metalness: .1, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide }),
    glace: new THREE.MeshStandardMaterial({ color: '#f2f8ff', emissive: '#9cc4ff', emissiveIntensity: .35, roughness: .35 }),
    led: new THREE.MeshBasicMaterial({ color: '#3f7bff', toneMapped: false }),
    vodka: new THREE.MeshStandardMaterial({ color: '#f4f7fb', emissive: '#cfe0ff', emissiveIntensity: .25, roughness: .55 }), // verre givré
    vodkaCap: new THREE.MeshStandardMaterial({ color: '#1d4fa8', metalness: .5, roughness: .3 }),
    vodkaBande: new THREE.MeshStandardMaterial({ color: '#2a5fc0', roughness: .4 }),
    champ: new THREE.MeshStandardMaterial({ color: '#123a24', metalness: .25, roughness: .15 }),
    foil: new THREE.MeshStandardMaterial({ color: '#e8b04a', metalness: 1, roughness: .25 }),
    champLabel: new THREE.MeshStandardMaterial({ color: '#f4efe2', roughness: .5 }),
    whisky: new THREE.MeshStandardMaterial({ color: '#9a4a12', emissive: '#4a1e04', emissiveIntensity: .4, roughness: .15 }),
    whiskyNeck: new THREE.MeshStandardMaterial({ color: '#141414', roughness: .4 }),
    whiskyLabel: new THREE.MeshStandardMaterial({ color: '#151515', roughness: .5 }),
    sparkler: new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: .9, roughness: .3 }),
    etincelle: new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: .95, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    verre: new THREE.MeshStandardMaterial({ color: '#e6f0ff', metalness: .1, roughness: .05, transparent: true, opacity: .3, depthWrite: false }),
    boisson: new THREE.MeshStandardMaterial({ color: '#ffc861', emissive: '#a0660a', emissiveIntensity: .3, roughness: .3 }),
  };
  const PIECES = { vodka: ['vodka', 'vodkaCap', 'vodkaBande'], champ: ['champ', 'foil', 'champLabel'], whisky: ['whisky', 'whiskyNeck', 'whiskyLabel'] };
  const HAUT = { vodka: .35, champ: .31, whisky: .27 };
  const L = {};
  const put = (k, m) => (L[k] ||= []).push(m.clone());
  const un = new THREE.Vector3(1, 1, 1), tmp = new THREE.Matrix4();
  const at = (x, y, z, q = new THREE.Quaternion()) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, un);
  // emplacements dans la vasque : x le long de l'ovale, bouteilles penchées vers l'extérieur comme dans un bac à glace
  const SLOTS = [[-.15, .03, -.42, .1], [-.06, -.05, -.2, -.25], [.02, .05, .12, .28], [.1, -.04, .28, -.2], [.17, .03, .45, .12]];
  const MIX = [['vodka', 'champ', 'whisky', 'vodka', 'champ'], ['champ', 'vodka', 'vodka', 'whisky', 'vodka'], ['whisky', 'vodka', 'champ', 'champ', 'vodka']];
  TABLES.forEach((t, i) => {
    const o = TABLE_OBJ.get(t.id); o.group.updateMatrixWorld(true);
    const W = (m) => tmp.multiplyMatrices(o.group.matrixWorld, m);
    const y = o.top;
    put('vasque', W(at(0, y, 0))); put('glace', W(at(0, y, 0))); put('led', W(at(0, y, 0)));
    const mix = MIX[i % 3];
    SLOTS.forEach(([x, z, rz, rx], k) => {
      const type = mix[k];
      const B = at(x, y + .05, z, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, -rz)));
      for (const p of PIECES[type]) put(p, W(B));
      if ((k + i) % 3 === 1) { // fontaine dorée plantée dans le goulot
        const S = B.clone().multiply(at(0, HAUT[type] - .02, 0));
        put('sparkler', W(S));
        const e = W(S.clone().multiply(at(0, .21, 0)));
        put('etincelle', e);
      }
    });
    [[.22, .27], [-.22, .27], [.22, -.27], [-.22, -.27]].forEach(([x, z]) => { put('verre', W(at(x, y, z))); put('boisson', W(at(x, y, z))); });
  });
  for (const [k, list] of Object.entries(L)) {
    const im = new THREE.InstancedMesh(G[k], MAT[k], list.length);
    list.forEach((m, j) => im.setMatrixAt(j, m));
    im.raycast = () => {};
    SERVICE.add(im);
    if (k === 'etincelle') ETINCELLES.push(im);
  }
}



// neige dans la salle
const SNOW_N = 450;
const snowGeo = new THREE.BufferGeometry();
const sp = new Float32Array(SNOW_N * 3);
for (let i = 0; i < SNOW_N; i++) { sp[i * 3] = (Math.random() - .5) * 62; sp[i * 3 + 1] = Math.random() * 18; sp[i * 3 + 2] = (Math.random() - .5) * 38 + 1; }
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: .12, transparent: true, opacity: .8, depthWrite: false }));
scene.add(snowPts);

/* ================================================================ repères de zones et de lignes */
// Le client ne choisit pas sa table : on affiche un repère par zone (1 à 4, scène),
// puis, dans la zone choisie, un repère par ligne (avant / arrière).
const labels = $('#labels');
stage.insertAdjacentHTML('beforeend', '<ul class="legende" aria-label="Légende"><li><i class="ok"></i>Disponible</li><li><i class="full"></i>Complet</li><li><i class="soon"></i>Bientôt</li></ul>');
const MARKS = [];
function centre(ts, up) { const v = new THREE.Vector3(); ts.forEach((t) => v.add(TABLE_OBJ.get(t.id).base)); v.multiplyScalar(1 / ts.length); v.y += up; return v; }
const placesTxt = (n) => `${n} place${n > 1 ? 's' : ''}`;
// état d'une ligne ou d'une zone : disponible (vert), complet (rouge), pas encore en vente (jaune)
const etatLigne = (l) => (!l.enVente ? 'soon' : restant(l.id) <= 0 ? 'full' : 'ok');
const etatGroupe = (g) => { const ls = ZONES.filter((l) => l.groupe === g.id); return ls.every((l) => !l.enVente) ? 'soon' : ls.some((l) => etatLigne(l) === 'ok') ? 'ok' : 'full'; };

// --- contours lumineux (zone survolée ou choisie, puis ligne) -------------------------------------------
function ruban(pts, y, w) { // bande plate centrée sur le contour fermé, angles en onglet
  const n = pts.length, pos = [];
  const aire = pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * p[1], 0);
  const sens = aire > 0 ? 1 : -1;
  const off = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const n1 = [(p[1] - a[1]), -(p[0] - a[0])], n2 = [(b[1] - p[1]), -(b[0] - p[0])];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
    const m = [n1[0] / l1 + n2[0] / l2, n1[1] / l1 + n2[1] / l2], lm = Math.hypot(...m) || 1;
    const k = Math.min(3, 1 / Math.max(.3, (m[0] / lm * n1[0] / l1 + m[1] / lm * n1[1] / l1))) * w / 2 * sens;
    return [[p[0] + m[0] / lm * k, p[1] + m[1] / lm * k], [p[0] - m[0] / lm * k, p[1] - m[1] / lm * k]];
  });
  for (let i = 0; i < n; i++) {
    const [o0, i0] = off[i], [o1, i1] = off[(i + 1) % n];
    pos.push(o0[0], y, o0[1], i0[0], y, i0[1], o1[0], y, o1[1], i0[0], y, i0[1], i1[0], y, i1[1], o1[0], y, o1[1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}
const CONTOUR_COEUR = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false, depthWrite: false, depthTest: false });
const CONTOUR_HALO = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: .22, toneMapped: false, depthWrite: false, depthTest: false });
function contour(pts, y) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ruban(pts, y + .02, .5), CONTOUR_HALO), new THREE.Mesh(ruban(pts, y + .03, .16), CONTOUR_COEUR));
  g.traverse((o) => { o.raycast = () => {}; o.renderOrder = 5; }); g.visible = false; scene.add(g); return g;
}
function enveloppe(P) { // enveloppe convexe (chaîne monotone)
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length > 1 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (hi.length > 1 && cr(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const ZONE_CONTOUR = new Map(GROUPES.map((g, i) => [g.id, contour(PLAN.PLATFORMS[i], H)]));
// chaque ligne = UNE bande continue (tous ses salons réunis, calculée sur le plan : PLAN.LIGNES_ZONE).
// Le client choisit une ligne, pas une table : on éclaire la bande entière, jamais table par table.
const LIGNE_BANDE = new Map();
ZONES.filter((l) => l.enVente).forEach((l) => {
  const pts = PLAN.LIGNES_ZONE[l.id]; if (!pts) return;
  const mat = new THREE.MeshBasicMaterial({ color: l.couleurs[0], transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(pts)), mat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = H + .02; fill.renderOrder = 3; fill.userData.ligne = l.id; fill.visible = false; scene.add(fill);
  LIGNE_BANDE.set(l.id, { fill, mat, bord: contour(pts, H + .01) });
});
let survolZone = null, survolLigne = null;
function majContours() {
  ZONE_CONTOUR.forEach((c, id) => (c.visible = !current && (id === activeGroupe || id === survolZone)));
  // zone ouverte : ses deux lignes apparaissent en bandes (avant dorée, arrière bleue) ; survol ou choix = bande vive + contour blanc
  LIGNE_BANDE.forEach((b, id) => {
    const l = ligneById(id), dansZone = activeGroupe === l.groupe, choisie = current?.id === id, survol = survolLigne === id;
    const complet = restant(id) <= 0;
    b.fill.visible = dansZone;
    b.mat.color.set(complet ? '#4b5670' : l.couleurs[0]);
    b.mat.opacity = !dansZone ? 0 : choisie ? .62 : current ? .06 : survol ? .5 : .3;
    b.bord.visible = dansZone && (choisie || (survol && !current));
  });
}

// --- étiquettes de prix façon billetterie : carte + tige + pastille d'état -------------------------------
GROUPES.forEach((g) => {
  const ts = TABLES.filter((t) => zoneOf(t).groupe === g.id);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'zmark pin' + (g.bientot ? ' soon vedette' : ''); b.dataset.g = g.id;
  b.setAttribute('aria-label', g.bientot ? 'Scène, pas encore en vente' : `${g.nom}, ${g.desc}`);
  b.addEventListener('click', () => selectGroupe(g.id));
  b.addEventListener('pointerenter', () => { survolZone = g.id; majContours(); });
  b.addEventListener('pointerleave', () => { survolZone = null; majContours(); });
  labels.appendChild(b); MARKS.push({ el: b, pos: centre(ts, .7), kind: 'g', id: g.id, g });
});
ZONES.filter((l) => l.enVente).forEach((l) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lmark pin2 ' + l.type;
  b.setAttribute('aria-label', `${l.nom}, ${l.prixPers} euros par personne`);
  b.addEventListener('click', () => selectLigne(l.id));
  b.addEventListener('pointerenter', () => glow(l.id, true));
  b.addEventListener('pointerleave', () => glow(l.id, false));
  labels.appendChild(b); MARKS.push({ el: b, pos: centre(tablesDe(l.id), 1.1), kind: 'l', id: l.id, groupe: l.groupe, l });
});
// repère DJ
{
  const e = document.createElement('span'); e.className = 'djmark'; e.textContent = 'DJ'; e.setAttribute('aria-hidden', 'true');
  labels.appendChild(e); MARKS.push({ el: e, pos: V(PLAN.DJ[0], PLAN.DJ[1], H + 2.2), kind: 'dj' });
}
function majMarques() {
  for (const m of MARKS) {
    if (m.kind === 'g') {
      const ls = ZONES.filter((l) => l.groupe === m.id && l.enVente), et = etatGroupe(m.g);
      const reste = ls.reduce((s, l) => s + Math.max(0, restant(l.id)), 0);
      m.el.dataset.etat = et;
      m.el.innerHTML = m.g.bientot
        ? '<span class="carte"><b>SCÈNE · AUTOUR DU DJ</b><span class="st">Bientôt disponible</span></span><span class="tige"></span><span class="pastille"></span>'
        : `<span class="carte"><small class="nm">${m.g.nom}</small><b>Dès ${Math.min(...ls.map((l) => l.prixPers))} € <i>/ pers.</i></b><span class="st"><i></i>${et === 'full' ? 'Complet' : placesTxt(reste) + ' restantes'}</span></span><span class="tige"></span><span class="pastille"></span>`;
    } else if (m.kind === 'l') {
      const et = etatLigne(m.l), r = Math.max(0, restant(m.l.id));
      m.el.dataset.etat = et;
      m.el.innerHTML = `<span class="pastille"></span><span class="trait"></span><span class="pill"><span class="lg">Ligne ${m.l.type === 'avant' ? 'avant' : 'arrière'}</span><span class="court">${m.l.type === 'avant' ? 'Avant' : 'Arrière'}</span> · <b>${m.l.prixPers} €</b><span class="ext">/pers. | ${et === 'full' ? 'complet' : placesTxt(r) + ' restante' + (r > 1 ? 's' : '')}</span></span>`;
    }
  }
  // largeur mesurée une fois ici (et pas à chaque image) ; repositionnement forcé
  for (const m of MARKS) if (m.kind === 'l') m.w = m.el.offsetWidth;
  marquesSales = true;
}
// surbrillance d'une ligne entière (canapés + contour blanc)
function teinte(m, id, survol) {
  const l = ligneById(id), choisie = current?.id === id;
  if (choisie) { m.emissive.set(l.couleurs[0]); m.emissiveIntensity = .6; }
  else if (survol) { m.emissive.set(l.couleurs[0]); m.emissiveIntensity = .28; }
  else { m.emissive.set('#000'); m.emissiveIntensity = 0; }
}
function glow(ligneId, on) {
  if (!ligneId) return;
  for (const t of tablesDe(ligneId)) {
    const o = TABLE_OBJ.get(t.id);
    o.mats.forEach((m) => teinte(m, ligneId, on));
  }
  survolLigne = on && ligneById(ligneId)?.enVente ? ligneId : survolLigne === ligneId ? null : survolLigne; majContours();
}
const tmp = new THREE.Vector3();
let marquesSales = true, derniereVue = '';
function placeLabels() {
  const w = stage.clientWidth, h = stage.clientHeight;
  // rien à recalculer si la caméra n'a pas bougé et que rien n'a changé
  const e = camera.matrixWorld.elements, vue = `${w}x${h}|${e[12].toFixed(3)},${e[13].toFixed(3)},${e[14].toFixed(3)},${e[8].toFixed(4)},${e[9].toFixed(4)},${e[10].toFixed(4)}|${camera.fov}|${activeGroupe}|${current?.id}`;
  if (!marquesSales && vue === derniereVue) return;
  marquesSales = false; derniereVue = vue;
  for (const m of MARKS) {
    const show = m.kind === 'g' ? activeGroupe !== m.id : m.kind === 'dj' ? true : activeGroupe === m.groupe;
    if (!show) { m.el.style.visibility = 'hidden'; continue; }
    tmp.copy(m.pos).project(camera);
    const off = tmp.z > 1 || Math.abs(tmp.x) > 1.15 || Math.abs(tmp.y) > 1.15;
    m.el.style.visibility = off ? 'hidden' : '';
    m.el.classList.toggle('dim', m.kind === 'g' && !!activeGroupe);
    m.el.classList.toggle('sel', m.kind === 'l' && current && current.id === m.id);
    const x = (tmp.x * .5 + .5) * w, y = (-tmp.y * .5 + .5) * h;
    // la pastille tombe exactement sur le point 3D : carte au-dessus (zones), étiquette à droite (lignes)
    // étiquette de ligne : à droite de sa pastille, ou à gauche s'il n'y a pas la place
    const gauche = m.kind === 'l' && x + (m.w || 0) > w - 8 && x > w - x;
    if (m.kind === 'l') m.el.classList.toggle('gauche', gauche);
    m.el.style.transform = m.kind === 'g' ? `translate(${x}px, ${y}px) translate(-50%, calc(-100% + 8px))`
      : m.kind === 'l' ? (gauche ? `translate(${x}px, ${y}px) translate(calc(-100% + 8px), -50%)` : `translate(${x}px, ${y}px) translate(-8px, -50%)`) : `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    m.el.style.zIndex = String((m.kind === 'l' ? 2000 : m.kind === 'g' ? 1500 : 0) + 1000 - Math.round(tmp.z * 1000));
  }
  // anti-chevauchement des cartes de zone : la carte la plus haute à l'écran monte jusqu'à ne plus toucher l'autre
  const cartes = MARKS.filter((m) => m.kind === 'g' && m.el.style.visibility !== 'hidden' && m.el.querySelector('.tige')); // cartes pas encore remplies : ignorées
  cartes.forEach((m) => { m.el.querySelector('.tige').style.height = ''; }); // la carte est ancrée par le bas : allonger la tige la fait monter
  for (let k = 0; k < 3; k++) for (const a of cartes) for (const b of cartes) {
    if (a === b) continue;
    const ra = a.el.firstElementChild?.getBoundingClientRect(), rb = b.el.firstElementChild?.getBoundingClientRect();
    if (!ra || !rb || ra.right < rb.left || rb.right < ra.left || ra.bottom < rb.top || rb.bottom < ra.top) continue;
    const haut = ra.top < rb.top ? a : b, bas = haut === a ? rb : ra, rh = haut === a ? ra : rb;
    haut.el.querySelector('.tige').style.height = `${haut.el.querySelector('.tige').offsetHeight + (rh.bottom - bas.top + 6)}px`;
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
  if (aspect >= 1.15) { HOME.pos.set(0, 47, 38); HOME.target.set(0, 0, 1.5); return; }
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
  const d = 25 / Math.tan(hfov / 2);
  HOME.pos.set(0, d * .93, d * .37); HOME.target.set(0, 0, -2.5); // salle un peu plus bas : place pour les étiquettes
}
function flyHome() { fitHome(); flyTo(HOME.pos.clone(), HOME.target.clone(), 1500); }
function flyGroupe(gid) { flyBox(TABLES.filter((t) => zoneOf(t).groupe === gid)); }
function flyZone(zoneId) { flyBox(tablesDe(zoneId)); }
function flyBox(ts) {
  const box = new THREE.Box3(); ts.forEach((t) => box.expandByPoint(TABLE_OBJ.get(t.id).anchor));
  const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
  const dist = Math.max(19, size * 1.7);
  const pos = c.clone().add(new THREE.Vector3(0, dist * .85, dist * .75));
  flyTo(pos, c, 1400);
}
// zoom cinématographique sur une table : la caméra se place derrière la table, en hauteur, regard vers la piste
function flyTable(t) {
  const o = TABLE_OBJ.get(t.id);
  const target = o.base.clone().setY(o.base.y + .3);
  const out = o.base.clone().setY(0).sub(new THREE.Vector3(0, 0, 0)).normalize(); // du centre vers la table
  if (out.lengthSq() < .01) out.set(0, 0, 1);
  const stageSide = t.zone === 'scene'; // scène : murs bas derrière, on arrive par l'arrière
  const pos = target.clone().addScaledVector(out, stageSide ? 4.6 : -3.8).add(new THREE.Vector3(0, stageSide ? 5.8 : 6.8, 0));
  // on garde un peu l'angle courant pour une trajectoire naturelle
  flyTo(pos, target, 1500);
}
let pov = false;
function enterPov(t) {
  const o = TABLE_OBJ.get(t.id);
  const onStageT = t.zone === 'scene';
  const eye = o.base.clone().setY(o.base.y + (onStageT ? 2.5 : 1.15)); // scène : on regarde par-dessus la cabine du DJ
  const look = V(0, 0, .8).lerp(V(PLAN.DJ[0], PLAN.DJ[1], 1.5), t.zone !== 'scene' ? .15 : 0);
  // regard depuis la table vers la piste ; on recule à peine pour voir ses propres canapés
  const dir = look.clone().sub(eye).setY(0).normalize();
  eye.addScaledVector(dir, onStageT ? -.9 : -1.9); if (!onStageT) eye.y += .35;
  pov = true; ring.visible = false;
  document.body.classList.add('pov-mode'); applyViewOffset();
  controls.enabled = false;
  flyTo(eye, look, 1800);
  $('#pov-txt').textContent = `Vue depuis la ${zoneOf(t).nom.toLowerCase()}`;
  $('#pov-bar').hidden = false; stage.classList.add('pov');
}
function exitPov(goHome = false) {
  if (!pov) return;
  pov = false; controls.enabled = true; $('#pov-bar').hidden = true; stage.classList.remove('pov');
  document.body.classList.remove('pov-mode'); applyViewOffset();
  if (current && !goHome) flyZone(current.id); else flyHome();
}
function zoomBy(f) {
  const d = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(d.length() * f, controls.minDistance, controls.maxDistance);
  flyTo(controls.target.clone().add(d.setLength(len)), controls.target.clone(), 450);
}
$('#zoom-in').onclick = () => zoomBy(.72);
$('#zoom-out').onclick = () => zoomBy(1.38);
$('#btn-overview').onclick = () => { exitPov(true); selectGroupe(null); };
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
const pickables = [...INST_PICK]; TABLE_OBJ.forEach((o) => o.group.traverse((m) => m.isMesh && pickables.push(m)));
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  const id = hit && (hit.object.userData.ids ? hit.object.userData.ids[hit.instanceId] : hit.object.userData.tableId);
  if (id) return { ligne: TABLES.find((t) => t.id === id).zone };
  const b = ray.intersectObjects([...LIGNE_BANDE.values()].filter((x) => x.fill.visible).map((x) => x.fill), false)[0];
  return b ? { ligne: b.object.userData.ligne } : null;
}
// point du sol visé (estrades comprises), pour savoir si l'on clique dans la zone ouverte ou à côté
const sol = new THREE.Plane(new THREE.Vector3(0, 1, 0), -H), visé = new THREE.Vector3();
function dansZoneOuverte() {
  if (!activeGroupe || !ray.ray.intersectPlane(sol, visé)) return false;
  const P = PLAN.PLATFORMS[GROUPES.findIndex((g) => g.id === activeGroupe)];
  return !!P && inPoly(visé.x, visé.z, P);
}
let down = null, hovered = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || pov) return;
  const t = pick(e);
  if (t) { const l = ligneById(t.ligne); return l.enVente ? selectLigne(l.id) : selectGroupe(l.groupe); }
  // clic dans le vide : hors de la zone ouverte on revient à toute la salle ; dans la zone, on annule juste la ligne
  if (!activeGroupe) return;
  if (dansZoneOuverte()) { if (current) selectGroupe(activeGroupe); } else selectGroupe(null);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || pov) return;
  const t = pick(e);
  const l = t ? t.ligne : null;
  if (!activeGroupe) { const gz = l ? ligneById(l).groupe : null; if (gz !== survolZone) { survolZone = gz; majContours(); } }
  else { if (hovered && hovered !== l) glow(hovered, false); if (l) glow(l, true); }
  hovered = l; canvas.style.cursor = t ? 'pointer' : activeGroupe && !dansZoneOuverte() ? 'zoom-out' : '';
});

// arrivée dans la salle : survol de la caméra la première fois que le plan est visible
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));
const INTRO = new THREE.Vector3(-50, 62, -52);
camera.position.copy(INTRO);
new IntersectionObserver((en, obs) => {
  if (!en[0].isIntersecting) return; obs.disconnect();
  if (current || activeGroupe || userMoved) return; // l'utilisateur a déjà choisi ou bougé la vue : on ne l'interrompt pas
  fitHome(); flyTo(HOME.pos.clone(), HOME.target.clone(), 2600);
}, { threshold: .35 }).observe(stage);

/* ================================================================ boucle */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = DESSUS ? 8 : w < 640 ? 55 : 42;
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
  SERVICE.visible = camera.position.distanceTo(controls.target) < 30;
  for (const e of ETINCELLES) { e.material.opacity = .55 + .45 * Math.abs(Math.sin(t * 23)); } // fontaines qui crépitent
  for (const f of FAISCEAUX) { f.m.rotation.x = 1.05 + Math.sin(t * .5 + f.k) * .28; f.m.rotation.z = Math.sin(t * .37 + f.k * 1.7) * .55; }
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
  if (matchMedia('(pointer: coarse)').matches) hint.textContent = 'Faites glisser pour tourner la salle';
  const hide = () => hint.classList.add('gone');
  canvas.addEventListener('pointerdown', hide, { once: true });
  setTimeout(hide, 9000);
}
// le bouton de l'accueil devient actif quand la salle est prête
requestAnimationFrame(() => { const c = $('#cta-main'); c.classList.remove('loading'); c.querySelector('.cta-txt').textContent = 'Réserver ma place'; c.insertAdjacentHTML('beforeend', '<span class="arrow">→</span>'); });

/* ================================================================ zones et lignes */
let activeGroupe = null;
let current = null; // ligne sélectionnée
const zonesEl = $('#zones');
const lignesDe = (gid) => ZONES.filter((l) => l.groupe === gid && l.enVente);
function renderZones() {
  zonesEl.innerHTML = '';
  const all = document.createElement('li');
  all.innerHTML = `<button type="button" class="zone all ${activeGroupe ? '' : 'active'}"><span class="zn">Toute la salle</span></button>`;
  all.firstChild.onclick = () => selectGroupe(null);
  zonesEl.appendChild(all);
  GROUPES.forEach((g) => {
    const ls = lignesDe(g.id), libres = ls.reduce((s, l) => s + restant(l.id), 0);
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="zone ${activeGroupe === g.id ? 'active' : ''} ${g.bientot || !libres ? 'full' : ''}" data-g="${g.id}">
      <span class="zn"><span class="znum">${g.num || '★'}</span><span>${g.bientot ? 'Scène' : g.nom}<small class="zdesc">${g.desc}</small></span></span>
      <span class="zp"><strong>${g.bientot ? 'Bientôt' : `dès ${Math.min(...ls.map((l) => l.prixPers))} €`}</strong><small>${g.bientot ? 'pas encore en vente' : libres ? '/ personne' : 'complet'}</small></span></button>`;
    li.firstChild.onclick = () => selectGroupe(g.id);
    zonesEl.appendChild(li);
  });
}
// couleurs 3D : ligne choisie en avant, lignes complètes et scène en gris
function refreshLabels() {
  majMarques(); majContours(); marquesSales = true;
  for (const l of ZONES) {
    const off = !l.enVente || restant(l.id) <= 0;
    const mine = current ? current.id === l.id : activeGroupe ? l.groupe === activeGroupe : true;
    const p = PLATE_MAT.get(l.id);
    p.color.set(off ? '#3a3f55' : l.couleurs[0]); p.emissive.set(off ? '#000' : l.couleurs[0]);
    p.emissiveIntensity = off ? 0 : mine ? (current ? .9 : .4) : .05;
    p.opacity = 0; p.visible = false; // la couleur est portée par la bande de la ligne, pas table par table
    LINE_MAT.get(l.id).color.set(mine || !activeGroupe ? '#e6dccb' : '#7d7a78');
    teinte(LINE_MAT.get(l.id), l.id, false);
  }
}
$('#only-free')?.closest('label')?.remove();

function openPanel() {
  const side = $('#side'); side.classList.add('closed', 'has-table'); $('#collapse').textContent = '+';
  const panel = $('#tpanel'); panel.hidden = false; panel.classList.remove('enter'); void panel.offsetWidth; panel.classList.add('enter');
  if (isSheet()) { document.body.classList.add('sheet-open'); scrollToEl(stage, sousEntete()); }
  applyViewOffset();
}
// 1) le client choisit une zone : on zoome et on propose ses deux lignes
function selectGroupe(gid) {
  exitPov(true);
  if (current) glow(current.id, false);
  activeGroupe = gid; current = null; $('#badge').hidden = true;
  renderZones(); refreshLabels();
  if (!gid) { closePanel(); flyHome(); return; }
  flyGroupe(gid);
  const g = GROUPES.find((x) => x.id === gid);
  $('#tp-eyebrow').textContent = VIP_NOM;
  $('#tp-title').textContent = g.bientot ? 'Scène' : g.nom;
  setStep(g.bientot ? 1 : 2);
  $('#tp-zone').textContent = g.desc;
  $('#tp-price').textContent = ''; $('#tp-sub').textContent = '';
  if (g.bientot) {
    $('#tp-lines').innerHTML = '';
    $('#tp-status').className = 'tp-status taken';
    $('#tp-status').innerHTML = '<strong>Pas encore en vente</strong>Les places autour du DJ seront annoncées prochainement. Choisissez une zone du VIP Croisette.';
    $('#tp-status').hidden = false; $('#tp-actions').hidden = true;
  } else {
    $('#tp-status').hidden = true; $('#tp-actions').hidden = true;
    $('#tp-lines').innerHTML = lignesDe(gid).map((l) => {
      const r = restant(l.id);
      return `<button type="button" class="tp-line ${l.type} ${r ? '' : 'full'}" data-l="${l.id}" style="--zc:${l.couleurs[0]}" ${r ? '' : 'disabled'}>
        <span><b>${l.libelle}</b><small>${l.type === 'avant' ? 'Premier rang, au bord de la piste' : 'Deuxième rang, juste derrière'}</small></span>
        <span class="tp-lp"><b>${l.prixPers} €</b><small>${r ? '/ personne' : 'complet'}</small></span></button>`;
    }).join('');
    $('#tp-lines').querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => selectLigne(b.dataset.l)));
    setTimeout(() => $('#tp-lines .tp-line:not(:disabled)')?.focus({ preventScroll: true }), 60);
  }
  openPanel();
}
// 2) le client choisit une ligne : prix par personne, puis demande
function selectLigne(id) {
  exitPov(true);
  const l = ligneById(id); if (!l) return;
  if (current) glow(current.id, false);
  activeGroupe = l.groupe; current = l;
  const r = restant(l.id), g = groupeOf(l);
  renderZones(); refreshLabels(); flyZone(l.id);
  const badge = $('#badge'); badge.textContent = `${g.nom} · ${l.libelle} · ${l.prixPers} € / pers.`; badge.hidden = false;
  badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
  $('#tp-eyebrow').textContent = `${VIP_NOM} · ${g.nom}`;
  $('#tp-title').textContent = l.libelle;
  setStep(3);
  $('#tp-zone').textContent = `${g.desc} · ${tablesDe(l.id).length} tables`;
  $('#tp-price').textContent = `${euros(l.prixPers)} / personne`;
  $('#tp-sub').textContent = `Pour 10 personnes : ${euros(totalLigne(l, 10))}. Votre table vous est attribuée par l’organisation.`;
  $('#tp-lines').innerHTML = `<button type="button" class="tp-back" id="tp-back">← Changer de ligne</button>`;
  $('#tp-back').onclick = () => selectGroupe(l.groupe);
  $('#tp-status').hidden = false;
  $('#tp-status').className = 'tp-status ' + (r ? 'free' : 'taken');
  // places réelles (serveur) : on dit simplement ce qu'il reste (jamais le total, pour ne pas donner l'impression d'une salle vide)
  const tot = placesDe(l.id); // le total n'est jamais affiché : seulement ce qui reste
  $('#tp-status').innerHTML = r
    ? `<strong>${r <= tot * .3 ? 'Plus que ' : ''}${r} place${r > 1 ? 's' : ''} restante${r > 1 ? 's' : ''}</strong>
       <ul class="atouts">${l.type === 'avant' ? '<li>Premier rang, au bord de la piste</li><li>Vue directe sur le DJ</li>' : '<li>Juste derrière la ligne avant</li><li>Vue sur la piste et le DJ</li>'}<li>Table attribuée par l’organisation</li></ul>`
    : '<strong>Complet</strong> Essayez l’autre ligne ou une autre zone.';
  $('#tp-actions').hidden = false; $('#tp-ask').disabled = !r;
  setTimeout(() => (r ? $('#tp-ask') : $('#tp-back'))?.focus({ preventScroll: true }), 60);
  try { sessionStorage.setItem('bal-noel-ligne', l.id); } catch {}
  openPanel();
}
function setStep(n) { $$('.steps li').forEach((li, i) => li.classList.toggle('on', i < n)); }
function closePanel() {
  setStep(1);
  if (current) glow(current.id, false);
  current = null; $('#badge').hidden = true; $('#tpanel').hidden = true;
  document.body.classList.remove('sheet-open'); applyViewOffset();
  const side = $('#side'); side.classList.remove('closed', 'has-table'); $('#collapse').textContent = '−';
}
const midTable = (l) => { const ts = tablesDe(l.id); return ts[Math.floor(ts.length / 2)]; };
// mobile / tablette : la fiche de la table s'ouvre en panneau bas, le plan reste visible au-dessus
function isSheet() { return innerWidth <= 1100; }
function applyViewOffset() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (isSheet() && document.body.classList.contains('sheet-open') && !document.body.classList.contains('pov-mode')) camera.setViewOffset(w, h, 0, h * .2, w, h);
  else camera.clearViewOffset();
}
addEventListener('resize', applyViewOffset, { passive: true });
function renderStrip() { $('#zone-strip').hidden = true; }
$('#tp-close').onclick = () => { exitPov(true); current ? selectGroupe(current.groupe) : selectGroupe(null); };
$('#tp-pov').onclick = () => current && enterPov(midTable(current));
$('#tp-ask').onclick = () => current && openDrawer(current);
const toggleZones = () => { const c = $('#side').classList.toggle('closed'); $('#collapse').textContent = c ? '+' : '−'; };
$('#collapse').onclick = (e) => { e.stopPropagation(); toggleZones(); };
$('.side-head').onclick = toggleZones;

/* ================================================================ fiche table + formulaire */
const drawer = $('#drawer'), back = $('#drawer-back'), form = $('#form');
function openDrawer(l) {
  const r = restant(l.id), max = Math.min(r, MAX_PAR_DEMANDE), g = groupeOf(l);
  $('#d-zone').textContent = `${VIP_NOM} · ${g.nom}`;
  $('#d-title').textContent = `${g.nom} · ${l.libelle}`;
  $('#d-price').textContent = euros(l.prixPers);
  $('#d-pers').innerHTML = `<option value="" selected disabled>Combien serez-vous ?</option>` + Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1} personne${i ? 's' : ''}</option>`).join('');
  majTotal();
  $('#d-taken').hidden = r > 0; form.hidden = r <= 0;
  $('#d-error').hidden = true;
  $('#d-form-view').hidden = false; $('#d-ok-view').hidden = true;
  lastFocus = document.activeElement;
  drawer.inert = false; drawer.hidden = false;
  if (!history.state?.formulaire) history.pushState({ v: 'plan', formulaire: 1 }, '', '#plan');
  void drawer.offsetWidth;
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); back.hidden = false;
  setTimeout(() => (r > 0 ? $('#d-pers') : $('#drawer-close')).focus({ preventScroll: true }), 350);
}
// total et acompte recalculés selon le nombre de personnes choisi
function majTotal() {
  if (!current) return;
  const n = Number($('#d-pers').value) || 0;
  $('#d-cap').textContent = n ? euros(totalLigne(current, n)) : '—';
  $('#d-dep').textContent = n ? euros(acompteLigne(current, n)) : '—';
}
$('#d-pers').addEventListener('change', majTotal);
let lastFocus = null;
function closeDrawer(depuisRetour) {
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); back.hidden = true; drawer.inert = true;
  if (!depuisRetour && history.state?.formulaire) history.back();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
// la touche Tab reste dans le formulaire tant qu'il est ouvert
drawer.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !drawer.classList.contains('open')) return;
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
  if (!Number(f.personnes)) problems.push('indiquez le nombre de personnes');
  if (!f.cgv) problems.push('cochez la case concernant l’acompte');
  const bad = { personnes: !Number(f.personnes), prenom: !f.prenom.trim(), nom: !f.nom.trim(), tel: f.tel.replace(/\D/g, '').length < 8, email: !!f.email && !/^\S+@\S+\.\S+$/.test(f.email), cgv: !f.cgv };
  Object.entries(bad).forEach(([k, v]) => form[k].setAttribute('aria-invalid', v ? 'true' : 'false'));
  if (problems.length) { err.textContent = 'Merci de vérifier : ' + problems.join(', ') + '.'; err.hidden = false; form[Object.keys(bad).find((k) => bad[k])].focus(); return; }
  const btn = $('#d-submit'); btn.disabled = true;
  try {
    const rep = await submitDemande({ ligne: current.id, prenom: f.prenom, nom: f.nom, tel: f.tel, email: f.email, personnes: f.personnes, contact: f.contact, message: f.message, website: f.website });
    const n = Number(f.personnes) || 1, dep = euros(acompteLigne(current, n));
    $('#d-ok-text').innerHTML = `Merci ${escapeHtml(f.prenom)} ! ${rep.doublon ? 'Votre demande en <strong>' + current.nom + '</strong> avait déjà été reçue : elle n’a pas été enregistrée une deuxième fois.' : `Votre demande en <strong>${current.nom}</strong> (${VIP_NOM}) est bien enregistrée.`}<br><br>
      L’organisation vous attribue votre table et vous contacte par <strong>${f.contact === 'sms' ? 'SMS' : 'WhatsApp'}</strong> au ${escapeHtml(f.tel)} dans les heures qui suivent.
      Pour ${n} personne${n > 1 ? 's' : ''} (${euros(totalLigne(current, n))}), un acompte de ${EVENT.acomptePct} % (${dep}) vous sera demandé après validation.<br><br><small>Numéro de demande : <strong>${escapeHtml(rep.id)}</strong></small>`;
    $('#d-form-view').hidden = true; $('#d-ok-view').hidden = false;
    $('#d-ok-view h3').setAttribute('tabindex', '-1'); $('#d-ok-view h3').focus({ preventScroll: true });
    form.reset();
  } catch (x) {
    err.textContent = x.message; err.hidden = false;
    await loadState(); refreshLabels(); renderZones(); if (current) selectLigne(current.id);
  } finally { btn.disabled = false; }
});
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ================================================================ démarrage */
drawer.inert = true;
await loadState();
renderZones(); refreshLabels();
setInterval(async () => { if (document.visibilityState === 'visible') { await loadState(); refreshLabels(); renderZones(); } }, 30000);
// après une actualisation sur le plan, on retrouve la ligne choisie
try { const l = sessionStorage.getItem('bal-noel-ligne'); if (l && body.dataset.view === 'plan' && ligneById(l)?.enVente) setTimeout(() => selectLigne(l), 400); } catch {}
// vue de dessus pour vérifier la 3D contre le plan PDF (?dessus dans l'adresse ; aucun effet sinon)
if (DESSUS) {
  userMoved = true; fly = null; camera.fov = 8; camera.far = 1000; scene.fog = null; camera.updateProjectionMatrix();
  camera.position.set(0, 400, .001); controls.target.set(0, 0, 0); controls.maxDistance = 1000; controls.update();
  labels.style.display = 'none'; snowPts.visible = false; bigStar.visible = false; floaters.forEach((f) => (f.ball.visible = false));
}
// caméra imposée pour les captures de contrôle (?cam=x,y,z,cx,cy,cz)
{
  const c = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
  if (c?.length === 6 && c.every(Number.isFinite)) { userMoved = true; fly = null; camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); controls.update(); }
}
