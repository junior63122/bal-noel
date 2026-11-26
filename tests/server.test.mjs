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
const LIGNES = ['z1-av', 'z1-ar', 'z2-av', 'z2-ar', 'z3-av', 'z3-ar', 'z4-av', 'z4-ar'];
const valid = (o = {}) => ({ ligne: 'z2-av', prenom: 'Test', nom: 'Auto', tel: '06 11 22 33 44', personnes: 4, contact: 'sms', ...o });

before(async () => {
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: PW, RENDER: '', TRUST_PROXY: '1' }, stdio: 'pipe' });
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
  const r = await post('/api/demandes', valid({ ligne: 'z1-ar', tel: '06 00 00 00 12' }));
  assert.equal(r.status, 201);
  const { id } = await r.json();
  await wait(150);
  assert.ok(disk().demandes.some((d) => d.id === id && d.ligne === 'z1-ar' && d.statut === 'nouvelle'), 'absente du fichier');
  const data = await (await admin('data')).json();
  assert.ok(data.demandes.some((d) => d.id === id), 'absente de l’admin');
});

test('données invalides refusées, et rien n’est enregistré', async () => {
  const before = disk().demandes.length;
  const cases = [
    [valid({ ligne: 'z9-av' }), 400], [valid({ ligne: '' }), 400], [valid({ ligne: undefined, table: '10' }), 400], [valid({ prenom: '' }), 400], [valid({ nom: '   ' }), 400],
    [valid({ tel: '123' }), 400], [valid({ tel: '<script>alert(1)</script>' }), 400], [valid({ tel: '0'.repeat(20) }), 400],
    [valid({ email: 'pas-un-email' }), 400], [valid({ personnes: 0 }), 400], [valid({ personnes: 31 }), 400], [valid({ personnes: 99 }), 400], [valid({ personnes: -3 }), 400], [valid({ personnes: 'abc' }), 400],
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
  const body = valid({ ligne: 'z3-av', tel: '07 12 12 12 12' });
  const [a, b] = await Promise.all([post('/api/demandes', body), post('/api/demandes', body)]);
  const ids = [(await a.json()).id, (await b.json()).id];
  const c = await (await post('/api/demandes', body)).json();
  assert.equal(c.doublon, true);
  await wait(150);
  const n = disk().demandes.filter((d) => d.ligne === 'z3-av' && d.tel === body.tel).length;
  assert.equal(n, 1, `créée ${n} fois (ids ${ids})`);
});

test('anti-spam : 6e envoi de la même adresse refusé (429)', async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post('/api/demandes', valid({ ligne: LIGNES[i], tel: `06 55 55 55 ${10 + i}` }), { 'x-forwarded-for': '192.0.2.77' })).status);
  assert.deepEqual(codes.slice(0, 5), [201, 201, 201, 201, 201]);
  assert.ok(codes.slice(5).every((c) => c === 429), codes.join(','));
});

test('l’adresse IP fournie par le client ne permet pas de contourner l’anti-spam', async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post('/api/demandes', valid({ ligne: LIGNES[i], tel: `06 66 66 66 ${10 + i}` }), { 'x-forwarded-for': `10.9.9.${i}, 192.0.2.88` })).status);
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
  const { id } = await (await post('/api/demandes', valid({ ligne: 'z4-av', tel: '06 50 50 50 50' }))).json();
  assert.equal((await admin('demande', { id, statut: '"><img src=x onerror=alert(1)>' })).status, 400);
  await wait(100);
  assert.equal(disk().demandes.find((d) => d.id === id).statut, 'nouvelle');
});

test('places : une demande validée décompte ses personnes ; une ligne complète refuse les demandes', async () => {
  // z2-ar = 4 tables × 6 = 24 places
  const st0 = await (await fetch(BASE + '/api/state')).json();
  assert.equal(st0.restant['z2-ar'], 24);
  const ids = [];
  for (const [n, tel] of [[20, '06 24 00 00 01'], [4, '06 24 00 00 02']]) ids.push((await (await post('/api/demandes', valid({ ligne: 'z2-ar', personnes: n, tel }))).json()).id);
  // non validées : les places ne bougent pas
  assert.equal((await (await fetch(BASE + '/api/state')).json()).restant['z2-ar'], 24);
  for (const id of ids) assert.equal((await admin('demande', { id, statut: 'validee' })).status, 200);
  const st = await (await fetch(BASE + '/api/state')).json();
  assert.equal(st.restant['z2-ar'], 0, 'places non décomptées');
  const r = await post('/api/demandes', valid({ ligne: 'z2-ar', personnes: 1, tel: '06 24 00 00 03' }));
  assert.equal(r.status, 409, 'une ligne complète accepte encore des demandes');
  // demander plus que les places restantes est refusé
  const id3 = (await (await post('/api/demandes', valid({ ligne: 'z3-ar', personnes: 20, tel: '06 24 00 00 04' }))).json()).id;
  await admin('demande', { id: id3, statut: 'validee' });
  assert.equal((await post('/api/demandes', valid({ ligne: 'z3-ar', personnes: 5, tel: '06 24 00 00 05' }))).status, 400);
  assert.equal((await post('/api/demandes', valid({ ligne: 'z3-ar', personnes: 4, tel: '06 24 00 00 06' }))).status, 201);
});

test('attribution des tables par l’admin : seulement dans la ligne, jamais deux fois', async () => {
  const a = (await (await post('/api/demandes', valid({ ligne: 'z1-av', tel: '06 31 00 00 01' }))).json()).id;
  const b = (await (await post('/api/demandes', valid({ ligne: 'z1-av', tel: '06 31 00 00 02' }))).json()).id;
  assert.equal((await admin('attribuer', { id: a, tables: ['27', '28'] })).status, 200);
  assert.equal((await admin('attribuer', { id: b, tables: ['28'] })).status, 409, 'table attribuée deux fois');
  assert.equal((await admin('attribuer', { id: b, tables: ['09'] })).status, 400, 'table hors de la ligne');
  assert.equal((await admin('attribuer', { id: b, tables: '27' })).status, 400);
  await wait(150);
  assert.deepEqual(disk().demandes.find((d) => d.id === a).tables, ['27', '28']);
  assert.deepEqual(disk().demandes.find((d) => d.id === b).tables, []);
  const st = await (await fetch(BASE + '/api/state')).json();
  assert.ok(st.reserved.includes('27') && st.reserved.includes('28'));
  // refuser la demande libère ses tables
  await admin('demande', { id: a, statut: 'refusee' });
  assert.equal((await admin('attribuer', { id: b, tables: ['28'] })).status, 200);
  // sans mot de passe : impossible
  assert.equal((await fetch(BASE + '/api/admin/attribuer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b, tables: [] }) })).status, 401);
});

test('santé : /api/health relit réellement le disque', async () => {
  const h = await (await fetch(BASE + '/api/health')).json();
  assert.equal(h.ok, true); assert.equal(h.disque, 'ok'); assert.equal(h.tables, undefined, 'la santé publique ne doit pas exposer le détail');
  // contre-test : si le fichier est corrompu, la santé doit passer en erreur
  const f = path.join(DATA, 'db.json'), keep = fs.readFileSync(f);
  fs.writeFileSync(f, '{corrompu');
  const bad = await fetch(BASE + '/api/health');
  fs.writeFileSync(f, keep);
  assert.equal(bad.status, 503, 'la santé ne détecte pas un fichier corrompu');
});

test('charge : 500 demandes simultanées, aucune perte, fichier valide', async () => {
  const before = disk().demandes.length;
  const rs = await Promise.all(Array.from({ length: 500 }, (_, i) => post('/api/demandes', valid({ ligne: ['z1-av', 'z4-av', 'z4-ar', 'z1-ar'][i % 4], personnes: 1, tel: `06 4${String(i).padStart(3, '0')} 00 00` }), { 'x-forwarded-for': `100.64.${i >> 8}.${i & 255}` })));
  const ok = rs.filter((r) => r.status === 201).length;
  await wait(400);
  assert.equal(ok, 500);
  assert.equal(disk().demandes.length, before + 500);
});

test('scène : pas encore en vente, aucune demande enregistrée', async () => {
  const before = disk().demandes.length;
  assert.equal((await post('/api/demandes', valid({ ligne: 'scene', tel: '06 45 00 00 45' }))).status, 409);
  await wait(150);
  assert.equal(disk().demandes.length, before);
});

test('sauvegarde : la copie du jour existe et se RESTAURE réellement sur un serveur neuf', async () => {
  await wait(300);
  const dir = path.join(DATA, 'sauvegardes');
  const f = fs.readdirSync(dir).filter((x) => x.startsWith('db-')).sort().at(-1);
  assert.ok(f, 'aucune sauvegarde');
  const copie = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  assert.ok(copie.demandes.length > 0);
  // restauration : un second serveur démarre avec la sauvegarde comme base
  const D2 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-restore-'));
  fs.copyFileSync(path.join(dir, f), path.join(D2, 'db.json'));
  const P2 = PORT + 1, s2 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P2), DATA_DIR: D2, ADMIN_PASSWORD: PW, RENDER: '', TRUST_PROXY: '1' }, stdio: 'ignore' });
  try {
    let h; for (let i = 0; i < 50; i++) { try { h = await (await fetch(`http://127.0.0.1:${P2}/api/health`)).json(); break; } catch { await wait(100); } }
    assert.equal(h.ok, true);
    const d = await (await fetch(`http://127.0.0.1:${P2}/api/admin/data`, { headers: { 'x-admin-password': PW } })).json();
    assert.equal(d.demandes.length, copie.demandes.length, 'restauration incomplète');
  } finally { s2.kill('SIGTERM'); }
});

test('pages légales, 404, robots et sitemap servis correctement', async () => {
  for (const p of ['/conditions', '/confidentialite', '/mentions-legales', '/robots.txt', '/sitemap.xml', '/assets/partage.jpg', '/fonts/manrope.woff2']) assert.equal((await fetch(BASE + p)).status, 200, p);
  const r = await fetch(BASE + '/page-qui-nexiste-pas'); assert.equal(r.status, 404); assert.match(await r.text(), /legal\.js/);
  const csp = (await fetch(BASE + '/')).headers.get('content-security-policy');
  assert.doesNotMatch(csp, /googleapis|gstatic/, 'des ressources Google restent autorisées');
  assert.doesNotMatch(await (await fetch(BASE + '/')).text(), /fonts\.googleapis/, 'polices Google encore chargées');
});

// ---------- défauts trouvés par le contre-audit indépendant (ils ne doivent jamais revenir)
test('C1 : l’admin ne peut pas valider au-delà des places de la ligne (surréservation)', async () => {
  const a = (await (await post('/api/demandes', valid({ ligne: 'z4-av', personnes: 30, tel: '06 71 00 00 01' }))).json()).id;
  const b = (await (await post('/api/demandes', valid({ ligne: 'z4-av', personnes: 30, tel: '06 71 00 00 02' }))).json()).id;
  assert.equal((await admin('demande', { id: a, statut: 'validee' })).status, 200);
  const r = await admin('demande', { id: b, statut: 'validee' });
  assert.equal(r.status, 409, 'surréservation acceptée');
  assert.match((await r.json()).error, /6 place/);
  await wait(150);
  assert.equal(disk().demandes.find((d) => d.id === b).statut, 'nouvelle');
});

test('C2 : une table ne peut jamais être à deux clients, ni bloquée si attribuée', async () => {
  const a = (await (await post('/api/demandes', valid({ ligne: 'z4-ar', personnes: 2, tel: '06 72 00 00 01' }))).json()).id;
  const b = (await (await post('/api/demandes', valid({ ligne: 'z4-ar', personnes: 2, tel: '06 72 00 00 02' }))).json()).id;
  await admin('attribuer', { id: a, tables: ['33'] });
  await admin('demande', { id: a, statut: 'refusee' });
  assert.equal((await admin('attribuer', { id: b, tables: ['33'] })).status, 200);
  await admin('demande', { id: a, statut: 'validee' }); // A revient : il ne doit pas récupérer la 33
  await wait(150);
  const D = disk().demandes;
  const avec33 = D.filter((d) => d.statut !== 'refusee' && (d.tables || []).includes('33'));
  assert.equal(avec33.length, 1, `table 33 attribuée ${avec33.length} fois`);
  assert.equal((await admin('table', { id: '33', reserved: true })).status, 409, 'blocage d’une table attribuée accepté');
});

test('C4 : renvoi MODIFIÉ (autre nombre) = nouvelle demande ; renvoi identique = doublon signalé', async () => {
  const r1 = await (await post('/api/demandes', valid({ ligne: 'z1-ar', personnes: 2, tel: '06 74 00 00 01' }))).json();
  const r2 = await (await post('/api/demandes', valid({ ligne: 'z1-ar', personnes: 8, message: 'finalement 8', tel: '06 74 00 00 01' }))).json();
  assert.notEqual(r2.id, r1.id); assert.ok(!r2.doublon);
  const r3 = await (await post('/api/demandes', valid({ ligne: 'z1-ar', personnes: 8, message: 'finalement 8', tel: '06 74 00 00 01' }))).json();
  assert.equal(r3.id, r2.id); assert.equal(r3.doublon, true);
  await admin('demande', { id: r2.id, statut: 'refusee' });
  const r4 = await (await post('/api/demandes', valid({ ligne: 'z1-ar', personnes: 8, message: 'finalement 8', tel: '06 74 00 00 01' }))).json();
  assert.notEqual(r4.id, r2.id, 'renvoi après refus rattaché à la demande refusée');
  await wait(150);
  assert.equal(disk().demandes.find((d) => d.id === r2.id).personnes, 8);
});

test('C3 + C5 : base abîmée → mise de côté et restaurée ; anciennes demandes migrées au bon prix sans doublon', async () => {
  const D3 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-c3-'));
  fs.mkdirSync(path.join(D3, 'sauvegardes'));
  const ancien = { reserved: ['30'], demandes: [
    { id: 'a1', date: new Date().toISOString(), table: '30', prenom: 'A', nom: 'A', tel: '0600000001', personnes: 6, statut: 'validee', contact: 'sms' },
    { id: 'a2', date: new Date().toISOString(), table: '30', prenom: 'B', nom: 'B', tel: '0600000002', personnes: 5, statut: 'nouvelle', contact: 'sms' }] };
  fs.writeFileSync(path.join(D3, 'sauvegardes', 'db-2026-11-20.json'), JSON.stringify(ancien));
  fs.writeFileSync(path.join(D3, 'db.json'), '{"reserved":[],"demandes":[{"id":"x"'); // tronqué
  const P3 = PORT + 2, s3 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P3), DATA_DIR: D3, ADMIN_PASSWORD: PW, RENDER: '' }, stdio: 'ignore' });
  try {
    let h; for (let i = 0; i < 50; i++) { try { h = await (await fetch(`http://127.0.0.1:${P3}/api/health`)).json(); break; } catch { await wait(100); } }
    assert.equal(h.restaureDepuis, 'db-2026-11-20.json');
    assert.ok(fs.readdirSync(D3).some((f) => f.startsWith('db.json.corrompu-')), 'fichier abîmé non conservé');
    const d = await (await fetch(`http://127.0.0.1:${P3}/api/admin/data`, { headers: { 'x-admin-password': PW } })).json();
    assert.equal(d.demandes.length, 2);
    for (const x of d.demandes) { assert.equal(x.ligne, 'z1-av'); assert.equal(x.prixPers, 150, 'ancien prix ailes non conservé'); }
    assert.equal(d.demandes.filter((x) => x.tables.includes('30')).length, 1, 'table 30 migrée en double');
    assert.ok(!d.reserved.includes('30'), 'table migrée restée bloquée');
  } finally { s3.kill('SIGTERM'); }
});

test('C6 : sans proxy de confiance, X-Forwarded-For est ignoré (anti-spam non contournable)', async () => {
  const P4 = PORT + 3, D4 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-c6-'));
  const s4 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P4), DATA_DIR: D4, ADMIN_PASSWORD: PW, RENDER: '', TRUST_PROXY: '' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${P4}/api/health`); break; } catch { await wait(100); } }
    const codes = [];
    for (let i = 0; i < 8; i++) codes.push((await fetch(`http://127.0.0.1:${P4}/api/demandes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `5.5.5.${i}` }, body: JSON.stringify(valid({ tel: `06 76 00 00 ${10 + i}` })) })).status);
    assert.ok(codes.slice(5).every((c) => c === 429), codes.join(','));
  } finally { s4.kill('SIGTERM'); }
});

test('C3 bis : un redémarrage n’écrase jamais la sauvegarde déjà faite ce jour-là', async () => {
  const D5 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-c3b-'));
  fs.mkdirSync(path.join(D5, 'sauvegardes'));
  const jour = new Date().toISOString().slice(0, 10), f = path.join(D5, 'sauvegardes', `db-${jour}.json`);
  const avant = JSON.stringify({ reserved: [], demandes: [{ id: 'garde', ligne: 'z1-av', personnes: 2, tel: '0600000009', prenom: 'G', nom: 'G', statut: 'nouvelle', date: new Date().toISOString() }] });
  fs.writeFileSync(f, avant);
  const P5 = PORT + 4, s5 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P5), DATA_DIR: D5, ADMIN_PASSWORD: PW, RENDER: '', TRUST_PROXY: '1' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${P5}/api/health`); break; } catch { await wait(100); } }
    assert.equal((await fetch(`http://127.0.0.1:${P5}/api/demandes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid({ tel: '06 79 00 00 01' })) })).status, 201);
    await wait(300);
    assert.equal(fs.readFileSync(f, 'utf8'), avant, 'sauvegarde du jour écrasée');
  } finally { s5.kill('SIGTERM'); }
});

// ---------- défauts trouvés par le 2e contre-audit (serveur)
import net from 'node:net';
test('A1 : une requête à l’URL invalide ne fait pas tomber le serveur', async () => {
  await new Promise((ok) => { const c = net.connect(PORT, '127.0.0.1', () => c.write('GET http://[ HTTP/1.1\r\nHost: x\r\n\r\n')); c.on('data', () => c.end()); c.on('close', ok); c.on('error', ok); setTimeout(ok, 1500); });
  await wait(200);
  assert.equal((await fetch(BASE + '/api/health')).status, 200, 'serveur arrêté');
});

test('A8 : accents coupés entre deux paquets restent intacts', async () => {
  const body = Buffer.from(JSON.stringify(valid({ prenom: 'Hélène', tel: '06 81 00 00 01' })));
  const cut = body.indexOf(Buffer.from('é')) + 1; // au milieu du « é »
  await new Promise((ok, ko) => {
    const c = net.connect(PORT, '127.0.0.1', async () => {
      c.write(`POST /api/demandes HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nX-Forwarded-For: 203.0.113.250\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`);
      c.write(body.subarray(0, cut)); await wait(150); c.write(body.subarray(cut));
    });
    c.on('data', () => {}); c.on('close', ok); c.on('error', ko);
  });
  await wait(150);
  assert.equal(disk().demandes.find((d) => d.tel === '06 81 00 00 01').prenom, 'Hélène');
});

test('A3 + A4 : écriture impossible → action admin et demande refusées (503), santé en erreur, aucun faux « ok »', async () => {
  const D6 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-a3-'));
  const P6 = PORT + 5, s6 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P6), DATA_DIR: D6, ADMIN_PASSWORD: PW, RENDER: '', TRUST_PROXY: '1' }, stdio: 'ignore' });
  const B = `http://127.0.0.1:${P6}`;
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(B + '/api/health'); break; } catch { await wait(100); } }
    const id = (await (await fetch(B + '/api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid({ tel: '06 82 00 00 01' })) })).json()).id;
    fs.mkdirSync(path.join(D6, 'db.json.tmp')); // l'écriture va échouer
    const r = await fetch(B + '/api/admin/demande', { method: 'POST', headers: { 'x-admin-password': PW, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, statut: 'validee' }) });
    assert.equal(r.status, 503, 'action admin annoncée réussie sans écriture');
    const body = JSON.stringify(valid({ tel: '06 82 00 00 02' }));
    const [x, y] = await Promise.all([1, 2].map(() => fetch(B + '/api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })));
    assert.deepEqual([x.status, y.status].sort(), [503, 503], 'un doublon a reçu « ok » pour une demande non enregistrée');
    const h = await fetch(B + '/api/health'); assert.equal(h.status, 503, 'santé « ok » malgré l’échec d’écriture');
    const hj = await h.json(); assert.equal(hj.ecrituresKO, undefined, 'détail exposé publiquement');
  } finally { s6.kill('SIGTERM'); }
});

test('A2 + A7 : base incohérente ({demandes:[null]}) restaurée depuis la sauvegarde ET réécrite sur disque', async () => {
  const D7 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-a7-'));
  fs.mkdirSync(path.join(D7, 'sauvegardes'));
  fs.writeFileSync(path.join(D7, 'sauvegardes', 'db-2026-11-25.json'), JSON.stringify({ reserved: [], demandes: [{ id: 'r1', ligne: 'z2-av', personnes: 4, tel: '0600000011', prenom: 'R', nom: 'R', statut: 'validee', date: new Date().toISOString() }] }));
  fs.writeFileSync(path.join(D7, 'db.json'), '{"reserved":[],"demandes":[null]}');
  const P7 = PORT + 6, s7 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P7), DATA_DIR: D7, ADMIN_PASSWORD: PW, RENDER: '' }, stdio: 'ignore' });
  try {
    let h; for (let i = 0; i < 50; i++) { try { h = await fetch(`http://127.0.0.1:${P7}/api/health`); break; } catch { await wait(100); } }
    assert.equal(h.status, 200, 'le serveur ne démarre pas ou la santé est en erreur');
    const onDisk = JSON.parse(fs.readFileSync(path.join(D7, 'db.json'), 'utf8'));
    assert.equal(onDisk.demandes[0].id, 'r1', 'base restaurée non réécrite sur disque');
  } finally { s7.kill('SIGTERM'); }
});

test('A9 : sous une rafale de 20 000 envois, l’anti-spam reste rapide (pas d’accumulation)', async () => {
  const P8 = PORT + 7, D8 = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-a9-'));
  const s8 = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(P8), DATA_DIR: D8, ADMIN_PASSWORD: PW, RENDER: '' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${P8}/api/health`); break; } catch { await wait(100); } }
    const lot = async () => { const t = Date.now(); for (let k = 0; k < 20; k++) await Promise.all(Array.from({ length: 500 }, () => fetch(`http://127.0.0.1:${P8}/api/demandes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}))); return Date.now() - t; };
    const t1 = await lot(), t2 = await lot();
    assert.ok(t2 < t1 * 2.5, `ralentissement : ${t1} ms puis ${t2} ms`);
  } finally { s8.kill('SIGTERM'); }
});
