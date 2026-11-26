// Tests d'intégration du serveur : on démarre un vrai serveur sur un port libre,
// avec un dossier de données temporaire, et on vérifie chaque résultat de façon indépendante
// (relecture du fichier sur disque, relecture via l'admin), jamais sur la seule réponse HTTP.
// Lancer : node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-test-'));
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'mot-de-passe-de-test-123';
let srv;
let ipSeq = 1;

const post = (p, body, headers = {}) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `203.0.113.${ipSeq++ % 250}`, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const admin = (p, body) => fetch(BASE + '/api/admin/' + p, { method: body ? 'POST' : 'GET', headers: { 'x-admin-password': PW, 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' }, body: body && JSON.stringify(body) });
const disk = () => JSON.parse(fs.readFileSync(path.join(DATA, 'db.json'), 'utf8'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const valid = (o = {}) => ({ table: '10', prenom: 'Test', nom: 'Auto', tel: '06 11 22 33 44', personnes: 4, contact: 'sms', ...o });

before(async () => {
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: PW, RENDER: '' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/state'); return; } catch { await wait(100); } }
  throw new Error('serveur non démarré');
});
after(() => srv.kill('SIGTERM'));

test('pages et fichiers servis, compressés, avec en-têtes de sécurité', async () => {
  const r = await fetch(BASE + '/', { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-encoding'), 'br');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await r.text(), /Choisir ma table|cta-main/);
  for (const f of ['/app.js', '/config.js', '/style.css', '/vendor/three.module.min.js', '/assets/boule.webp', '/admin']) assert.equal((await fetch(BASE + f)).status, 200, f);
});

test('chemins piégés refusés (traversée de dossier, encodage invalide)', async () => {
  for (const p of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/%E0%A4%A', '/public/../../etc/passwd']) {
    const r = await fetch(BASE + p);
    assert.ok([400, 403, 404].includes(r.status), `${p} → ${r.status}`);
    assert.doesNotMatch(await r.text(), /ADMIN_PASSWORD|root:/);
  }
});

test('une demande valide est réellement enregistrée (vérifiée sur disque ET via l’admin)', async () => {
  const r = await post('/api/demandes', valid({ table: '12', tel: '06 00 00 00 12' }));
  assert.equal(r.status, 201);
  const { id } = await r.json();
  await wait(150);
  assert.ok(disk().demandes.some((d) => d.id === id && d.table === '12'), 'absente du fichier');
  const data = await (await admin('data')).json();
  assert.ok(data.demandes.some((d) => d.id === id), 'absente de l’admin');
});

test('données invalides refusées, et rien n’est enregistré', async () => {
  const before = disk().demandes.length;
  const cases = [
    [valid({ table: '99' }), 400], [valid({ table: '' }), 400], [valid({ prenom: '' }), 400], [valid({ nom: '   ' }), 400],
    [valid({ tel: '123' }), 400], [valid({ tel: '<script>alert(1)</script>' }), 400], [valid({ tel: '0'.repeat(20) }), 400],
    [valid({ email: 'pas-un-email' }), 400], [valid({ personnes: 0 }), 400], [valid({ personnes: 7 }), 400], [valid({ personnes: 99 }), 400], [valid({ personnes: 'abc' }), 400],
  ];
  for (const [body, code] of cases) assert.equal((await post('/api/demandes', body)).status, code, JSON.stringify(body));
  assert.equal((await post('/api/demandes', '{pas du json')).status, 400);
  assert.equal((await post('/api/demandes', 'x'.repeat(30000))).status, 413);
  assert.equal((await post('/api/demandes', valid(), { 'Content-Type': 'text/plain' })).status, 415);
  await wait(150);
  assert.equal(disk().demandes.length, before, 'une donnée invalide a été enregistrée');
});

test('pot de miel : un robot reçoit « ok » mais rien n’est enregistré', async () => {
  const before = disk().demandes.length;
  assert.equal((await post('/api/demandes', valid({ website: 'http://spam', tel: '06 99 99 99 99' }))).status, 200);
  await wait(150);
  assert.equal(disk().demandes.length, before);
});

test('double clic : la même demande n’est pas créée deux fois', async () => {
  const body = valid({ table: '20', tel: '07 12 12 12 12' });
  const [a, b] = await Promise.all([post('/api/demandes', body), post('/api/demandes', body)]);
  const ids = [(await a.json()).id, (await b.json()).id];
  const c = await (await post('/api/demandes', body)).json();
  assert.equal(c.doublon, true);
  await wait(150);
  const n = disk().demandes.filter((d) => d.table === '20' && d.tel === body.tel).length;
  assert.equal(n, 1, `créée ${n} fois (ids ${ids})`);
});

test('anti-spam : 6e envoi de la même adresse refusé (429)', async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post('/api/demandes', valid({ table: String(30 + i), tel: `06 55 55 55 ${10 + i}` }), { 'x-forwarded-for': '192.0.2.77' })).status);
  assert.deepEqual(codes.slice(0, 5), [201, 201, 201, 201, 201]);
  assert.ok(codes.slice(5).every((c) => c === 429), codes.join(','));
});

test('l’adresse IP fournie par le client ne permet pas de contourner l’anti-spam', async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post('/api/demandes', valid({ table: String(40 + i), tel: `06 66 66 66 ${10 + i}` }), { 'x-forwarded-for': `10.9.9.${i}, 192.0.2.88` })).status);
  assert.ok(codes.slice(5).every((c) => c === 429), codes.join(','));
});

test('admin : mauvais mot de passe refusé, puis blocage après 10 essais', async () => {
  const bad = () => fetch(BASE + '/api/admin/data', { headers: { 'x-admin-password': 'faux', 'x-forwarded-for': '192.0.2.200' } });
  const codes = []; for (let i = 0; i < 11; i++) codes.push((await bad()).status);
  assert.ok(codes.slice(0, 10).every((c) => c === 401));
  assert.equal(codes[10], 429);
  assert.equal((await fetch(BASE + '/api/admin/data')).status, 401, 'sans mot de passe');
});

test('admin : statut inconnu refusé (pas d’injection dans le tableau de bord)', async () => {
  const { id } = await (await post('/api/demandes', valid({ table: '15', tel: '06 50 50 50 50' }))).json();
  assert.equal((await admin('demande', { id, statut: '"><img src=x onerror=alert(1)>' })).status, 400);
  await wait(100);
  assert.equal(disk().demandes.find((d) => d.id === id).statut, 'nouvelle');
});

test('valider une demande réserve la table ; la table devient indisponible au public', async () => {
  const { id } = await (await post('/api/demandes', valid({ table: '05', tel: '06 05 05 05 05' }))).json();
  assert.equal((await admin('demande', { id, statut: 'validee' })).status, 200);
  const state = await (await fetch(BASE + '/api/state')).json();
  assert.ok(state.reserved.includes('05'), 'table non bloquée côté public');
  await wait(150);
  assert.ok(disk().reserved.includes('05'), 'table non bloquée sur disque');
  const r = await post('/api/demandes', valid({ table: '05', tel: '06 77 05 05 05' }));
  assert.equal(r.status, 409, 'une table réservée accepte encore des demandes');
});

test('santé : /api/health relit réellement le disque', async () => {
  const h = await (await fetch(BASE + '/api/health')).json();
  assert.equal(h.ok, true); assert.equal(h.disque, 'ok'); assert.equal(h.tables, 64);
  // contre-test : si le fichier est corrompu, la santé doit passer en erreur
  const f = path.join(DATA, 'db.json'), keep = fs.readFileSync(f);
  fs.writeFileSync(f, '{corrompu');
  const bad = await fetch(BASE + '/api/health');
  fs.writeFileSync(f, keep);
  assert.equal(bad.status, 503, 'la santé ne détecte pas un fichier corrompu');
});

test('charge : 500 demandes simultanées, aucune perte, fichier valide', async () => {
  const before = disk().demandes.length;
  const tables = Array.from({ length: 44 }, (_, i) => String(i + 1).padStart(2, '0')).filter((t) => t !== '05');
  const rs = await Promise.all(Array.from({ length: 500 }, (_, i) => post('/api/demandes', valid({ table: tables[i % tables.length], tel: `06 4${String(i).padStart(3, '0')} 00 00` }), { 'x-forwarded-for': `100.64.${i >> 8}.${i & 255}` })));
  const ok = rs.filter((r) => r.status === 201).length;
  await wait(400);
  assert.equal(ok, 500);
  assert.equal(disk().demandes.length, before + 500);
});

test('tables de la scène (45 à 64) : pas encore en vente, aucune demande enregistrée', async () => {
  const before = disk().demandes.length;
  for (const t of ['45', '50', '64']) assert.equal((await post('/api/demandes', valid({ table: t, tel: `06 45 00 00 ${t}` }))).status, 409, t);
  await wait(150);
  assert.equal(disk().demandes.length, before);
});
