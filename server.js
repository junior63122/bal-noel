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
import { TABLES, ZONES, MAX_PAR_DEMANDE, placesDe, EVENT } from './public/config.js';

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
const LIGNES = new Map(ZONES.map((l) => [l.id, l]));
const LIGNE_DE_TABLE = new Map(TABLES.map((t) => [t.id, t.zone]));
// places restantes d'une ligne = places de la ligne − personnes des demandes validées
const restantLigne = (db, id) => placesDe(id) - db.demandes.filter((d) => d.ligne === id && d.statut === 'validee').reduce((s, d) => s + d.personnes, 0);
// tables prises = tables bloquées à la main + tables attribuées à une demande non refusée
const tablesPrises = (db, sauf) => new Set([...db.reserved, ...db.demandes.filter((d) => d.id !== sauf && d.statut !== 'refusee').flatMap((d) => d.tables || [])]);
fs.mkdirSync(DATA_DIR, { recursive: true });

// la base est gardée en mémoire (lecture instantanée), et écrite sur disque après chaque changement
let DBMEM, RESTAURE = null;
const SAUV = path.join(DATA_DIR, 'sauvegardes');
const lireBase = (f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (!Array.isArray(j.demandes) || !Array.isArray(j.reserved)) throw new Error('format'); return j; };
if (!fs.existsSync(DB)) DBMEM = { reserved: [], demandes: [] };
else {
  try { DBMEM = lireBase(DB); }
  catch (e) {
    // fichier abîmé : on le met de côté (jamais écrasé) et on repart de la dernière sauvegarde lisible
    const mis = `${DB}.corrompu-${Date.now()}`; fs.renameSync(DB, mis);
    const copies = fs.existsSync(SAUV) ? fs.readdirSync(SAUV).filter((x) => x.startsWith('db-')).sort().reverse() : [];
    for (const c of copies) { try { DBMEM = lireBase(path.join(SAUV, c)); RESTAURE = c; break; } catch {} }
    if (!DBMEM) DBMEM = { reserved: [], demandes: [] };
    console.error(`⚠ db.json illisible, mis de côté dans ${path.basename(mis)} ; ${RESTAURE ? 'restauré depuis ' + RESTAURE : 'AUCUNE sauvegarde lisible'}`);
  }
}
// migration des anciennes demandes « par table » : ligne de la table, prix d'origine figé, table gardée seulement si libre
{
  const anciensPrix = (t) => (Number(t) >= 9 && Number(t) <= 20 ? 200 : Number(t) <= 44 ? 150 : null);
  const prises = new Set();
  for (const d of DBMEM.demandes) {
    if (!d.ligne && d.table) {
      d.ligne = LIGNE_DE_TABLE.get(d.table) || 'inconnue'; d.prixPers ??= anciensPrix(d.table);
      d.tables = d.statut !== 'refusee' && !prises.has(d.table) ? [d.table] : [];
      DBMEM.reserved = DBMEM.reserved.filter((x) => x !== d.table); delete d.table;
    }
    if (d.prixPers === undefined) d.prixPers = LIGNES.get(d.ligne)?.prixPers ?? null;
    (d.tables ||= []).forEach((t) => prises.add(t));
  }
}
let stateCache = null;
const load = () => DBMEM;
let lastBackup = '';
function dailyBackup(db) { // une copie par jour (la première de la journée, jamais écrasée), conservée 14 jours
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackup) return; lastBackup = day;
  const dir = SAUV; fs.mkdirSync(dir, { recursive: true });
  fs.promises.writeFile(path.join(dir, `db-${day}.json`), JSON.stringify(db), { flag: 'wx' }).catch(() => {});
  fs.promises.readdir(dir).then((f) => f.sort().slice(0, -14).forEach((x) => fs.promises.unlink(path.join(dir, x)).catch(() => {}))).catch(() => {});
}
let enCours = null, prochaine = null;
function save(db) {
  DBMEM = db; stateCache = null; dailyBackup(db);
  if (prochaine) return prochaine; // une écriture est déjà prévue : elle contiendra ce changement
  prochaine = (async () => {
    await null; // laisse l'affectation de « prochaine » se terminer avant de la remettre à zéro
    if (enCours) await enCours.catch(() => {});
    prochaine = null;
    enCours = fs.promises.writeFile(DB + '.tmp', JSON.stringify(DBMEM, null, 2)).then(() => fs.promises.rename(DB + '.tmp', DB));
    try { await enCours; } catch (e) { METRICS.ecrituresKO++; METRICS.derniereErreur = 'écriture: ' + e.message; console.error('Écriture impossible', e); throw e; }
  })();
  prochaine.catch(() => {});
  return prochaine;
}
// RGPD : effacement automatique des demandes N jours après la soirée (vérifié au démarrage puis toutes les 6 h)
function purge() {
  const limite = Date.parse(EVENT.debut) + EVENT.conservationJours * 864e5;
  if (Date.now() < limite || !DBMEM.demandes.length) return;
  console.log(`Purge RGPD : ${DBMEM.demandes.length} demande(s) effacée(s)`);
  save({ ...DBMEM, demandes: [] });
}
setTimeout(purge, 5000); setInterval(purge, 6 * 3600e3).unref();
// sauvegarde synchrone à l'arrêt (redéploiement Render)
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { fs.writeFileSync(DB + '.tmp', JSON.stringify(DBMEM, null, 2)); fs.renameSync(DB + '.tmp', DB); } catch {} process.exit(0); });

const STATIC = new Map();
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.xml', '.txt']);
function getStatic(file) {
  if (STATIC.has(file)) return STATIC.get(file);
  let raw; try { raw = fs.readFileSync(file); } catch { return null; }
  const ext = path.extname(file);
  const f = { raw, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 16) + '"',
    // pages : toujours revalidées ; images et librairies : en cache 1 jour
    cache: ext === '.html' || file.endsWith('app.js') || file.endsWith('config.js') || ext === '.css' ? 'no-cache'
      : ext === '.woff2' || file.includes(path.sep + 'vendor' + path.sep) ? 'public, max-age=2592000, immutable' : 'public, max-age=86400' };
  if (COMPRESSIBLE.has(ext)) {
    f.gz = zlib.gzipSync(raw, { level: 9 });
    f.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
  }
  STATIC.set(file, f);
  return f;
}
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

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
const TRUST_PROXY = !!(process.env.RENDER || process.env.TRUST_PROXY);
function clientIp(req) { if (!TRUST_PROXY) return req.socket.remoteAddress; return String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean).at(-1) || req.socket.remoteAddress; }
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
    try { await (prochaine || enCours || Promise.resolve()).catch(() => {}); const onDisk = JSON.parse(fs.readFileSync(DB, 'utf8')); if (onDisk.demandes.length !== DBMEM.demandes.length) disque = 'désynchronisé'; }
    catch (e) { disque = fs.existsSync(DB) ? 'illisible' : (DBMEM.demandes.length ? 'absent' : 'vide'); }
    const ok = disque === 'ok' || disque === 'vide';
    return send(res, ok ? 200 : 503, { ok, disque, restaureDepuis: RESTAURE, adminActive: ADMIN_PASSWORD.length >= 10, uptimeMin: Math.round((Date.now() - STARTED) / 60000),
      tables: TABLES.length, reservees: tablesPrises(db).size, demandes: db.demandes.length, ...METRICS });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') { stateCache ||= JSON.stringify({ reserved: [...tablesPrises(db)], restant: Object.fromEntries(ZONES.filter((l) => l.enVente).map((l) => [l.id, Math.max(0, restantLigne(db, l.id))])) }); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(stateCache); }

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
      ligne: clean(b.ligne, 10), tables: [], prenom: clean(b.prenom, 60), nom: clean(b.nom, 60),
      tel: clean(b.tel, 30), email: clean(b.email, 120), personnes: Math.round(Number(b.personnes)) || 0,
      contact: b.contact === 'sms' ? 'sms' : 'whatsapp', message: clean(b.message, 1000), statut: 'nouvelle',
    };
    const ligne = LIGNES.get(d.ligne);
    if (!ligne) return send(res, 400, { error: 'Ligne inconnue.' });
    if (!ligne.enVente) { METRICS.rejets++; return send(res, 409, { error: 'Cette zone n’est pas encore en vente.' }); }
    const digits = d.tel.replace(/\D/g, '');
    if (!d.prenom || !d.nom || digits.length < 8 || digits.length > 15 || /[^\d\s+().-]/.test(d.tel)) { METRICS.rejets++; return send(res, 400, { error: 'Nom, prénom et un numéro de téléphone valide sont obligatoires.' }); }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { METRICS.rejets++; return send(res, 400, { error: 'L’adresse e-mail semble incorrecte.' }); }
    const reste = restantLigne(db, d.ligne);
    if (reste <= 0) { METRICS.rejets++; return send(res, 409, { error: 'Cette ligne est complète. Choisissez une autre ligne.' }); }
    const maxi = Math.min(reste, MAX_PAR_DEMANDE);
    if (d.personnes < 1 || d.personnes > maxi) { METRICS.rejets++; return send(res, 400, { error: `Indiquez entre 1 et ${maxi} personnes.` }); }
    // double clic ou renvoi : même téléphone, même ligne, moins de 30 min → on renvoie la demande existante
    d.prixPers = ligne.prixPers;
    const dup = db.demandes.find((x) => x.statut !== 'refusee' && x.personnes === d.personnes && (x.message || '') === d.message && x.ligne === d.ligne && x.tel.replace(/\D/g, '') === digits && Date.now() - Date.parse(x.date) < 1800000);
    if (dup) return send(res, 200, { ok: true, id: dup.id, doublon: true });
    db.demandes.unshift(d);
    // succès renvoyé UNIQUEMENT après écriture réelle sur disque
    try { await save(db); } catch { DBMEM.demandes = DBMEM.demandes.filter((x) => x.id !== d.id); stateCache = null; return send(res, 503, { error: 'Enregistrement impossible pour le moment : votre demande n’a pas été enregistrée. Réessayez dans un instant.' }); }
    METRICS.demandes++;
    console.log(`Nouvelle demande ${d.id} — ${d.ligne} — ${d.personnes} pers.`); // pas de données personnelles dans les journaux
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
      if (reserved && db.demandes.some((d) => d.statut !== 'refusee' && (d.tables || []).includes(id))) return send(res, 409, { error: `La table ${id} est déjà attribuée à une demande.` });
      db.reserved = db.reserved.filter((x) => x !== id);
      if (reserved) db.reserved.push(id);
      save(db); return send(res, 200, db);
    }
    // l'organisation attribue une ou plusieurs tables de la ligne à une demande
    if (req.method === 'POST' && url.pathname === '/api/admin/attribuer') {
      const { id, tables } = await readBody(req);
      const d = db.demandes.find((x) => x.id === id);
      if (!d) return send(res, 404, { error: 'Demande introuvable.' });
      if (!Array.isArray(tables) || tables.length > 20) return send(res, 400, { error: 'Liste de tables invalide.' });
      const prises = tablesPrises(db, d.id);
      for (const t of tables) {
        if (LIGNE_DE_TABLE.get(t) !== d.ligne) return send(res, 400, { error: `La table ${t} n’est pas dans cette ligne.` });
        if (prises.has(t)) return send(res, 409, { error: `La table ${t} est déjà attribuée.` });
      }
      d.tables = [...new Set(tables)].sort();
      save(db); return send(res, 200, db);
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/demande') {
      const { id, statut } = await readBody(req);
      const d = db.demandes.find((x) => x.id === id);
      if (!d) return send(res, 404, { error: 'Demande introuvable.' });
      if (statut === 'supprimer') db.demandes = db.demandes.filter((x) => x.id !== id);
      else {
        if (!STATUTS.has(statut)) return send(res, 400, { error: 'Statut inconnu.' });
        if (statut === 'validee' && d.statut !== 'validee') {
          const reste = restantLigne(db, d.ligne);
          if (d.personnes > reste) return send(res, 409, { error: `Impossible de valider : ${d.personnes} personnes demandées, ${Math.max(0, reste)} place(s) restante(s) sur cette ligne.` });
        }
        if (d.statut === 'refusee' && statut !== 'refusee') {
          const prises = tablesPrises(db, d.id);
          const perdues = (d.tables || []).filter((t) => prises.has(t));
          if (perdues.length) d.tables = d.tables.filter((t) => !prises.has(t));
        }
        d.statut = statut;
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
    if (!path.extname(p) && p !== '/') p += '.html'; // /mentions-legales → mentions-legales.html
    const file = path.join(PUB, path.normalize(p));
    if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
    let f = getStatic(file), status = 200;
    if (!f) { f = getStatic(path.join(PUB, '404.html')); status = 404; }
    if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
    const headers = { 'Content-Type': f.type, 'Cache-Control': f.cache, ETag: f.etag, Vary: 'Accept-Encoding' };
    if (status === 200 && req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers); return res.end(); }
    const ae = String(req.headers['accept-encoding'] || '');
    if (f.br && /\bbr\b/.test(ae)) { headers['Content-Encoding'] = 'br'; res.writeHead(status, headers); return res.end(f.br); }
    if (f.gz && /\bgzip\b/.test(ae)) { headers['Content-Encoding'] = 'gzip'; res.writeHead(status, headers); return res.end(f.gz); }
    res.writeHead(status, headers); res.end(f.raw);
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
