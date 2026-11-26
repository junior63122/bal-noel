// Tests anti-faux-succès côté client (navigateur réel, serveur de test local, données fictives).
// Chaque scénario essaie de tromper l'interface ; le verdict est établi par une source INDÉPENDANTE
// de l'interface : relecture des demandes via l'API d'administration.
// États : SUCCESS_VERIFIED · FAILED (échec correctement signalé) · FAUX_SUCCES (l'interface ment) · FAUX_ECHEC
//   NODE_PATH=$(npm root -g) node tests/faux-succes.cjs
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-fs-'));
const PORT = 4300 + Math.floor(Math.random() * 100), BASE = `http://127.0.0.1:${PORT}`, PW = 'faux-succes-password';
const admin = async () => (await fetch(BASE + '/api/admin/data', { headers: { 'x-admin-password': PW } })).json();

let ipSeq = 1;
async function parcours(browser, { nom, tel, ligne = 'z1-av', personnes = 3, route, dblclick, prenom = 'Test', message = '' }) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // une adresse distincte par visiteur simulé, sinon l'anti-spam fausse les résultats
  const ip = `198.18.0.${ipSeq++}`;
  await p.route(BASE + '/**', (r) => r.fallback({ headers: { ...r.request().headers(), 'x-forwarded-for': ip } }));
  const errs = []; let dialog = false;
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => { dialog = true; d.dismiss(); });
  if (route) await route(p);
  await p.goto(BASE + '/#plan'); await p.waitForTimeout(2500);
  await p.locator('.zmark').nth(Number(ligne[1]) - 1).dispatchEvent('click'); await p.waitForTimeout(900);
  await p.click(`.tp-line[data-l="${ligne}"]`); await p.waitForTimeout(900);
  await p.click('#tp-ask'); await p.waitForSelector('#drawer.open'); await p.waitForTimeout(400);
  await p.selectOption('#d-pers', String(personnes));
  await p.fill('[name=prenom]', prenom); await p.fill('[name=nom]', nom); await p.fill('[name=tel]', tel);
  if (message) await p.fill('[name=message]', message);
  await p.check('[name=cgv]');
  dblclick ? await p.dblclick('#d-submit') : await p.click('#d-submit');
  await p.waitForFunction(() => !document.querySelector('#d-ok-view').hidden || !document.querySelector('#d-error').hidden, null, { timeout: 30000 }).catch(() => {});
  const ui = { succes: await p.isVisible('#d-ok-view'), erreur: (await p.textContent('#d-error')).trim() };
  await p.close();
  return { ui, errs, dialog };
}

const SCENARIOS = [
  { id: 'S1', titre: 'Coupure réseau au chargement (/api/state échoue une fois)', attendu: 'SUCCESS_VERIFIED',
    route: (p) => { let n = 0; return p.route('**/api/state', (r) => (n++ === 0 ? r.abort('internetdisconnected') : r.fallback())); } },
  { id: 'S2', titre: 'Le serveur répond 200 « ok » mais sans numéro de demande', attendu: 'FAILED', msg: /incomplète/,
    route: (p) => p.route('**/api/demandes', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })) },
  { id: 'S3', titre: 'Réponse 200 non JSON (page d’erreur d’un proxy)', attendu: 'FAILED',
    route: (p) => p.route('**/api/demandes', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html>Bad gateway</html>' })) },
  { id: 'S4', titre: 'Coupure réseau pendant l’envoi', attendu: 'FAILED', msg: /Connexion impossible/,
    route: (p) => p.route('**/api/demandes', (r) => r.abort('internetdisconnected')) },
  { id: 'S5', titre: 'Erreur serveur 500', attendu: 'FAILED', msg: /panne|réessayez/i,
    route: (p) => p.route('**/api/demandes', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"panne"}' })) },
  { id: 'S6', titre: 'Le serveur ne répond pas (délai dépassé)', attendu: 'FAILED', msg: /n’a pas confirmé/,
    route: (p) => p.route('**/api/demandes', async () => {}) }, // jamais de réponse
  { id: 'S7', titre: 'La demande arrive mais la réponse se perd ; le client réessaie (pas de doublon)', attendu: 'SUCCESS_VERIFIED_UNIQUE',
    route: (p) => { let n = 0; return p.route('**/api/demandes', async (r) => { if (n++ === 0) { await r.fetch(); return r.abort('connectionreset'); } return r.fallback(); }); }, retry: true },
  { id: 'S8', titre: 'Double clic sur « Envoyer »', attendu: 'SUCCESS_VERIFIED_UNIQUE', dblclick: true },
  { id: 'S9', titre: 'Nom avec émojis et code HTML piégé, message très long', attendu: 'SUCCESS_VERIFIED_SAFE',
    prenom: 'Zoé 🎄✨', nomPiege: '<img src=x onerror=alert(1)>', message: 'é'.repeat(3000) },
  { id: 'S10', titre: 'Ligne complète entre l’ouverture de la page et l’envoi', attendu: 'FAILED', complet: true, msg: /complète/ },
];

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: PW, RENDER: '', TRUST_PROXY: '1' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/health'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const res = [];
  for (const [i, s] of SCENARIOS.entries()) {
    const tel = `06 77 00 ${String(10 + i).padStart(2, '0')} 00`, nom = s.nomPiege || `Scenario${s.id}`;
    let ligne = 'z1-av';
    if (s.complet) { // on remplit la ligne z4-ar pendant que le client a la page ouverte
      ligne = 'z4-ar';
      s.route = (p) => p.route('**/api/demandes', async (r) => {
        const H = { 'x-admin-password': PW, 'Content-Type': 'application/json' };
        // on remplit toute la ligne (places lues sur le serveur, par demandes de 30 au plus)
        let reste = (await (await fetch(BASE + '/api/state')).json()).restant['z4-ar'], k = 0;
        while (reste > 0) {
          const n = Math.min(30, reste);
          const g = await (await fetch(BASE + '/api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.6.6.' + (6 + k) }, body: JSON.stringify({ ligne: 'z4-ar', personnes: n, prenom: 'G', nom: 'Groupe' + k, tel: '06 00 66 66 6' + k }) })).json();
          await fetch(BASE + '/api/admin/demande', { method: 'POST', headers: H, body: JSON.stringify({ id: g.id, statut: 'validee' }) });
          reste -= n; k++;
        }
        r.fallback();
      });
    }
    let out = await parcours(browser, { nom, tel, ligne, route: s.route, dblclick: s.dblclick, prenom: s.prenom, message: s.message });
    if (s.retry && !out.ui.succes) out = await parcours(browser, { nom, tel, ligne }); // le client réessaie
    const recues = (await admin()).demandes.filter((d) => d.tel === tel);
    let verdict;
    if (out.ui.succes && recues.length === 0) verdict = 'FAUX_SUCCES';
    else if (!out.ui.succes && recues.length > 0 && s.attendu === 'FAILED') verdict = 'FAUX_ECHEC';
    else if (!out.ui.succes) verdict = 'FAILED';
    else if (recues.length === 1) verdict = s.attendu === 'SUCCESS_VERIFIED_SAFE' ? (out.dialog || out.errs.length ? 'XSS_OU_ERREUR' : 'SUCCESS_VERIFIED_SAFE') : (s.attendu === 'SUCCESS_VERIFIED_UNIQUE' ? 'SUCCESS_VERIFIED_UNIQUE' : 'SUCCESS_VERIFIED');
    else verdict = `DOUBLON (${recues.length})`;
    // l'administration affiche-t-elle le nom piégé sans l'exécuter ?
    if (s.nomPiege && recues.length) {
      const p = await browser.newPage(); let alerte = false; p.on('dialog', (d) => { alerte = true; d.dismiss(); });
      await p.goto(BASE + '/admin'); await p.fill('#pw', PW); await p.click('#login button'); await p.waitForTimeout(800);
      const affiche = await p.locator('#rows').textContent();
      if (alerte || !affiche.includes('<img src=x')) verdict = 'XSS_ADMIN'; await p.close();
      if (recues[0].message.length > 1000) verdict = 'MESSAGE_NON_TRONQUE';
    }
    // le bon échec, pour la bonne raison : le message affiché doit correspondre à la cause
    const ok = verdict === s.attendu && (!s.msg || s.msg.test(out.ui.erreur));
    res.push({ id: s.id, titre: s.titre, attendu: s.attendu, obtenu: verdict, ok, erreurAffichee: out.ui.erreur.slice(0, 140) });
    console.log(`${ok ? '✔' : '✘'} ${s.id} ${s.titre}\n   attendu ${s.attendu} · obtenu ${verdict}${out.ui.erreur ? ` · message : « ${out.ui.erreur.slice(0, 110)} »` : ''}`);
  }
  await browser.close(); srv.kill('SIGTERM');
  fs.writeFileSync(path.join(__dirname, 'rapport-faux-succes.json'), JSON.stringify(res, null, 1));
  const ko = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - ko}/${res.length} scénarios conformes`);
  process.exit(ko ? 1 : 0);
})();
