// Serveur minimal (Node ≥ 18, aucune dépendance) : site + API de réservation.
//   PORT            port d'écoute (3000 par défaut)
//   ADMIN_PASSWORD  mot de passe de /admin (obligatoire en production)
//   DATA_DIR        dossier où est stocké db.json (./data par défaut)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { TABLES } from './public/config.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'noel2026';
if (!process.env.ADMIN_PASSWORD) console.warn('⚠  ADMIN_PASSWORD non défini : mot de passe par défaut « noel2026 ».');

const TABLE_IDS = new Set(TABLES.map((t) => t.id));
fs.mkdirSync(DATA_DIR, { recursive: true });

// la base est gardée en mémoire (lecture instantanée), et écrite sur disque après chaque changement
let DBMEM;
try { DBMEM = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { DBMEM = { reserved: [], demandes: [] }; }
let stateCache = null;
const load = () => DBMEM;
let writing = false, again = false;
function save(db) {
  DBMEM = db; stateCache = null;
  if (writing) { again = true; return; }
  writing = true;
  fs.promises.writeFile(DB + '.tmp', JSON.stringify(db, null, 2))
    .then(() => fs.promises.rename(DB + '.tmp', DB))
    .catch((e) => console.error('Écriture impossible', e))
    .finally(() => { writing = false; if (again) { again = false; save(DBMEM); } });
}
// sauvegarde synchrone à l'arrêt (redéploiement Render)
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { fs.writeFileSync(DB, JSON.stringify(DBMEM, null, 2)); } catch {} process.exit(0); });

const STATIC = new Map();
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json']);
function getStatic(file) {
  if (STATIC.has(file)) return STATIC.get(file);
  let raw; try { raw = fs.readFileSync(file); } catch { return null; }
  const ext = path.extname(file);
  const f = { raw, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 16) + '"',
    // pages : toujours revalidées ; images et librairies : en cache 1 jour
    cache: ext === '.html' || file.endsWith('app.js') || file.endsWith('config.js') || ext === '.css' ? 'no-cache' : 'public, max-age=86400' };
  if (COMPRESSIBLE.has(ext)) {
    f.gz = zlib.gzipSync(raw, { level: 9 });
    f.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
  }
  STATIC.set(file, f);
  return f;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 20000) { reject(new Error('trop gros')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('JSON invalide')); } });
  });
}
function isAdmin(req) {
  const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
  const want = Buffer.from(ADMIN_PASSWORD);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// anti-spam très simple : 5 demandes / 10 min par IP
const hits = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 600000)) hits.delete(k); }, 300000).unref();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 5;
}

async function api(req, res, url) {
  const db = load();

  if (req.method === 'GET' && url.pathname === '/api/state') { stateCache ||= JSON.stringify({ reserved: db.reserved }); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(stateCache); }

  if (req.method === 'POST' && url.pathname === '/api/demandes') {
    // derrière le proxy Render, la dernière adresse ajoutée est la seule fiable
    const ip = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean).at(-1) || req.socket.remoteAddress;
    if (limited(ip)) return send(res, 429, { error: 'Trop de demandes, réessayez plus tard.' });
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true }); // pot de miel
    const d = {
      id: crypto.randomUUID().slice(0, 8),
      date: new Date().toISOString(),
      table: clean(b.table, 4), prenom: clean(b.prenom, 60), nom: clean(b.nom, 60),
      tel: clean(b.tel, 30), email: clean(b.email, 120), personnes: Number(b.personnes) || 0,
      contact: b.contact === 'sms' ? 'sms' : 'whatsapp', message: clean(b.message, 1000), statut: 'nouvelle',
    };
    if (!TABLE_IDS.has(d.table)) return send(res, 400, { error: 'Table inconnue.' });
    if (!d.prenom || !d.nom || d.tel.replace(/\D/g, '').length < 8) return send(res, 400, { error: 'Nom, prénom et téléphone sont obligatoires.' });
    if (db.reserved.includes(d.table)) return send(res, 409, { error: 'Cette table vient d’être réservée. Choisissez-en une autre.' });
    db.demandes.unshift(d); save(db);
    console.log(`Nouvelle demande ${d.id} — table ${d.table} — ${d.prenom} ${d.nom} ${d.tel}`);
    return send(res, 201, { ok: true, id: d.id });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Mot de passe incorrect.' });
    if (req.method === 'GET' && url.pathname === '/api/admin/data') return send(res, 200, db);
    if (req.method === 'POST' && url.pathname === '/api/admin/table') {
      const { id, reserved } = await readBody(req);
      if (!TABLE_IDS.has(id)) return send(res, 400, { error: 'Table inconnue.' });
      db.reserved = db.reserved.filter((x) => x !== id);
      if (reserved) db.reserved.push(id);
      save(db); return send(res, 200, db);
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/demande') {
      const { id, statut } = await readBody(req);
      const d = db.demandes.find((x) => x.id === id);
      if (!d) return send(res, 404, { error: 'Demande introuvable.' });
      if (statut === 'supprimer') db.demandes = db.demandes.filter((x) => x.id !== id);
      else {
        d.statut = clean(statut, 20);
        // une demande validée bloque la table automatiquement
        if (d.statut === 'validee' && !db.reserved.includes(d.table)) db.reserved.push(d.table);
      }
      save(db); return send(res, 200, db);
    }
  }
  return send(res, 404, { error: 'Introuvable' });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    if (p === '/admin') p = '/admin.html';
    const file = path.join(PUB, path.normalize(p));
    if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    const f = getStatic(file);
    if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
    const headers = { 'Content-Type': f.type, 'Cache-Control': f.cache, ETag: f.etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers); return res.end(); }
    const ae = String(req.headers['accept-encoding'] || '');
    if (f.br && /\bbr\b/.test(ae)) { headers['Content-Encoding'] = 'br'; res.writeHead(200, headers); return res.end(f.br); }
    if (f.gz && /\bgzip\b/.test(ae)) { headers['Content-Encoding'] = 'gzip'; res.writeHead(200, headers); return res.end(f.gz); }
    res.writeHead(200, headers); res.end(f.raw);
  } catch (e) {
    send(res, 400, { error: e.message });
  }
}).listen(PORT, () => {
  // préchauffe : tous les fichiers du site sont lus et compressés une fois au démarrage
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : getStatic(path.join(d, e.name))));
  const t0 = Date.now(); walk(PUB);
  console.log(`Bal de Noël → http://localhost:${PORT}  (admin : /admin) — ${STATIC.size} fichiers prêts en ${Date.now() - t0} ms`);
});
