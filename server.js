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
import { TABLES, ZONES } from './public/config.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) {
  // en ligne, on refuse de démarrer sans vrai mot de passe ; en local, l'admin est simplement désactivée
  if (process.env.RENDER || process.env.NODE_ENV === 'production') { console.error('ADMIN_PASSWORD manquant ou trop court (10 caractères minimum).'); process.exit(1); }
  console.warn('⚠  ADMIN_PASSWORD absent ou trop court : administration désactivée.');
}
const STATUTS = new Set(['nouvelle', 'contactee', 'validee', 'refusee']);
const STARTED = Date.now();
const METRICS = { demandes: 0, rejets: 0, erreurs: 0, ecrituresKO: 0, adminKO: 0, derniereErreur: null };

const TABLE_IDS = new Set(TABLES.map((t) => t.id));
const CAPACITE = new Map(TABLES.map((t) => [t.id, ZONES.find((z) => z.id === t.zone).capacite]));
fs.mkdirSync(DATA_DIR, { recursive: true });

// la base est gardée en mémoire (lecture instantanée), et écrite sur disque après chaque changement
let DBMEM;
try { DBMEM = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { DBMEM = { reserved: [], demandes: [] }; }
let stateCache = null;
const load = () => DBMEM;
let writing = false, again = false, lastBackup = '';
function dailyBackup(db) { // une copie par jour, conservée 14 jours
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackup) return; lastBackup = day;
  const dir = path.join(DATA_DIR, 'sauvegardes'); fs.mkdirSync(dir, { recursive: true });
  fs.promises.writeFile(path.join(dir, `db-${day}.json`), JSON.stringify(db)).catch(() => {});
  fs.promises.readdir(dir).then((f) => f.sort().slice(0, -14).forEach((x) => fs.promises.unlink(path.join(dir, x)).catch(() => {}))).catch(() => {});
}
function save(db) {
  DBMEM = db; stateCache = null; dailyBackup(db);
  if (writing) { again = true; return; }
  writing = true;
  fs.promises.writeFile(DB + '.tmp', JSON.stringify(db, null, 2))
    .then(() => fs.promises.rename(DB + '.tmp', DB))
    .catch((e) => { METRICS.ecrituresKO++; METRICS.derniereErreur = 'écriture: ' + e.message; console.error('Écriture impossible', e); })
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
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, code, body) {
  if (code >= 500) METRICS.erreurs++;
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '', big = false;
    req.on('data', (c) => { if (big) return; s += c; if (s.length > 20000) { big = true; s = ''; } });
    req.on('end', () => { if (big) return reject(Object.assign(new Error('trop gros'), { code: 413 })); try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('JSON invalide')); } });
  });
}
const adminFails = new Map();
function clientIp(req) { return String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean).at(-1) || req.socket.remoteAddress; }
function isAdmin(req) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) return false;
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

  if (req.method === 'GET' && url.pathname === '/api/health') {
    // contrôle réel : la base est relue depuis le disque et comparée à la mémoire
    let disque = 'ok';
    try { const onDisk = JSON.parse(fs.readFileSync(DB, 'utf8')); if (!writing && onDisk.demandes.length !== DBMEM.demandes.length) disque = 'désynchronisé'; }
    catch (e) { disque = fs.existsSync(DB) ? 'illisible' : (DBMEM.demandes.length ? 'absent' : 'vide'); }
    const ok = disque === 'ok' || disque === 'vide';
    return send(res, ok ? 200 : 503, { ok, disque, adminActive: ADMIN_PASSWORD.length >= 10, uptimeMin: Math.round((Date.now() - STARTED) / 60000),
      tables: TABLES.length, reservees: db.reserved.length, demandes: db.demandes.length, ...METRICS });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') { stateCache ||= JSON.stringify({ reserved: db.reserved }); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(stateCache); }

  if (req.method === 'POST' && url.pathname === '/api/demandes') {
    // derrière le proxy Render, la dernière adresse ajoutée est la seule fiable
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'Format non accepté.' });
    const ip = clientIp(req);
    if (limited(ip)) { METRICS.rejets++; return send(res, 429, { error: 'Trop de demandes, réessayez plus tard.' }); }
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true }); // pot de miel
    const d = {
      id: crypto.randomUUID().slice(0, 8),
      date: new Date().toISOString(),
      table: clean(b.table, 4), prenom: clean(b.prenom, 60), nom: clean(b.nom, 60),
      tel: clean(b.tel, 30), email: clean(b.email, 120), personnes: Math.round(Number(b.personnes)) || 0,
      contact: b.contact === 'sms' ? 'sms' : 'whatsapp', message: clean(b.message, 1000), statut: 'nouvelle',
    };
    if (!TABLE_IDS.has(d.table)) return send(res, 400, { error: 'Table inconnue.' });
    const digits = d.tel.replace(/\D/g, '');
    if (!d.prenom || !d.nom || digits.length < 8 || digits.length > 15 || /[^\d\s+().-]/.test(d.tel)) { METRICS.rejets++; return send(res, 400, { error: 'Nom, prénom et un numéro de téléphone valide sont obligatoires.' }); }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { METRICS.rejets++; return send(res, 400, { error: 'L’adresse e-mail semble incorrecte.' }); }
    if (d.personnes < 1 || d.personnes > CAPACITE.get(d.table)) { METRICS.rejets++; return send(res, 400, { error: `Cette table accueille de 1 à ${CAPACITE.get(d.table)} personnes.` }); }
    // double clic ou renvoi : même téléphone, même table, moins de 30 min → on renvoie la demande existante
    const dup = db.demandes.find((x) => x.table === d.table && x.tel.replace(/\D/g, '') === digits && Date.now() - Date.parse(x.date) < 1800000);
    if (dup) return send(res, 200, { ok: true, id: dup.id, doublon: true });
    if (db.reserved.includes(d.table)) return send(res, 409, { error: 'Cette table vient d’être réservée. Choisissez-en une autre.' });
    db.demandes.unshift(d); save(db);
    METRICS.demandes++;
    console.log(`Nouvelle demande ${d.id} — table ${d.table}`); // pas de données personnelles dans les journaux
    return send(res, 201, { ok: true, id: d.id });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    const ip = clientIp(req), now = Date.now();
    const fails = (adminFails.get(ip) || []).filter((t) => now - t < 900000);
    if (fails.length >= 10) return send(res, 429, { error: 'Trop d’essais. Réessayez dans 15 minutes.' });
    if (!isAdmin(req)) { fails.push(now); adminFails.set(ip, fails); METRICS.adminKO++; return send(res, 401, { error: 'Mot de passe incorrect.' }); }
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
        if (!STATUTS.has(statut)) return send(res, 400, { error: 'Statut inconnu.' });
        d.statut = statut;
        // une demande validée bloque la table automatiquement
        if (d.statut === 'validee' && !db.reserved.includes(d.table)) db.reserved.push(d.table);
      }
      save(db); return send(res, 200, db);
    }
  }
  return send(res, 404, { error: 'Introuvable' });
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
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
    if (!res.headersSent) send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'Message trop long.' : 'Requête invalide.' });
  }
});
server.requestTimeout = 15000; server.headersTimeout = 10000;
server.listen(PORT, () => {
  // préchauffe : tous les fichiers du site sont lus et compressés une fois au démarrage
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : getStatic(path.join(d, e.name))));
  const t0 = Date.now(); walk(PUB);
  console.log(`Bal de Noël → http://localhost:${PORT}  (admin : /admin) — ${STATIC.size} fichiers prêts en ${Date.now() - t0} ms`);
});
