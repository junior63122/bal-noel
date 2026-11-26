// Vérifications d'interface issues du contre-audit (navigateur réel, serveur de test local, données fictives).
//   NODE_PATH=$(npm root -g) node tests/interface.cjs
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..'), DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-ui-'));
const PORT = 4500 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`, PW = 'interface-password';
const res = [];
const ok = (id, cond, info = '') => { res.push({ id, ok: !!cond }); console.log(`${cond ? '✔' : '✘'} ${id}${info ? ' — ' + info : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: PW, TRUST_PROXY: '1' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/health'); break; } catch { await wait(100); } }
  const GL = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'];
  let b = await chromium.launch({ args: GL });

  // U1 : la touche Tab n'entre jamais dans le formulaire fermé
  let p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/#plan'); await wait(3000);
  let dedans = 0;
  for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => !!document.activeElement.closest('#drawer'))) dedans++; }
  ok('U1 clavier : formulaire fermé inatteignable', dedans === 0, `${dedans} arrêt(s) dans le formulaire fermé`);

  // U12 : parcours au clavier, le focus suit
  await p.locator('.zone[data-g="z3"]').focus(); await p.keyboard.press('Enter'); await wait(1200);
  const f1 = await p.evaluate(() => document.activeElement.className);
  await p.keyboard.press('Enter'); await wait(1200);
  const f2 = await p.evaluate(() => document.activeElement.id);
  ok('U12 focus suit le parcours (zone → ligne → Continuer)', /tp-line/.test(f1) && f2 === 'tp-ask', `${f1} / ${f2}`);
  await p.keyboard.press('Enter'); await wait(700);
  ok('U1 bis formulaire ouvert au clavier', await p.isVisible('#drawer.open'));

  // U7 : Retour ferme le formulaire sans quitter le plan ; la ligne survit à une actualisation
  await p.goBack(); await wait(800);
  ok('U7 Retour ferme le formulaire et reste sur le plan', !(await p.isVisible('#drawer.open')) && (await p.evaluate(() => document.body.dataset.view)) === 'plan');
  await p.reload(); await wait(3500);
  ok('U7 bis actualisation : ligne choisie retrouvée', /Ligne (avant|arrière)/.test(await p.textContent('#tp-title').catch(() => '')));
  await p.close(); await b.close();

  // U2 : sans WebGL, réservation possible
  b = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(BASE + '/'); await wait(3500);
  const ctaOk = !(await p.getAttribute('#cta-main', 'class')).includes('loading');
  await p.click('#cta-main'); await wait(1500);
  await p.click('.zone[data-g="z1"]'); await wait(500); await p.click('.tp-line[data-l="z1-ar"]'); await wait(500);
  await p.click('#tp-ask'); await wait(500); await p.selectOption('#d-pers', '2');
  await p.fill('[name=prenom]', 'Sans'); await p.fill('[name=nom]', 'GL'); await p.fill('[name=tel]', '06 90 00 00 01'); await p.check('[name=cgv]');
  await p.click('#d-submit'); await p.waitForSelector('#d-ok-view:not([hidden])', { timeout: 10000 }).catch(() => {});
  const adm = await (await fetch(BASE + '/api/admin/data', { headers: { 'x-admin-password': PW } })).json();
  ok('U2 sans 3D : bouton actif et réservation enregistrée', ctaOk && adm.demandes.some((d) => d.tel === '06 90 00 00 01'));
  await b.close();

  b = await chromium.launch({ args: GL });
  // U8 : sur mobile, « Toute la salle » et le rappel de prix restent visibles après le choix d'une ligne
  p = await b.newPage({ ...devices['iPhone 13'] });
  await p.goto(BASE + '/#plan'); await wait(3000);
  await p.locator('.zmark').nth(1).dispatchEvent('click'); await wait(1500); await p.click('.tp-line.avant'); await wait(1800);
  const vis = await p.evaluate(() => ['#btn-overview', '#badge'].map((s) => { const e = document.querySelector(s), r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!h && (h === e || e.contains(h)); }));
  ok('U8 mobile : « Toute la salle » et rappel de prix non masqués', vis.every(Boolean), JSON.stringify(vis));
  await p.close();

  // U6 : admin sur téléphone sans débordement ; U3 + U4 liens WhatsApp
  for (const [i, t] of ['+33 (0)6 12 34 56 80', '6 12 34 56 82', '06.12.34.56.83', '+32 470 12 34 56'].entries())
    await fetch(BASE + '/api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.1.1.' + (i + 1) }, body: JSON.stringify({ ligne: 'z2-av', personnes: 2, prenom: 'W', nom: 'A', tel: t, contact: 'whatsapp' }) });
  p = await b.newPage({ ...devices['iPhone 13'] });
  await p.goto(BASE + '/admin'); await p.fill('#pw', PW); await p.click('#login button'); await wait(900);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok('U6 admin mobile : pas de débordement de la page', sw[0] <= sw[1] + 1, `${sw[0]} / ${sw[1]}`);
  const liens = await p.$$eval('a.wa', (as) => as.map((a) => decodeURIComponent(a.href)));
  const nums = liens.map((h) => (h.match(/wa\.me\/(\d+)/) || [])[1]);
  ok('U3 WhatsApp : numéros internationaux corrects', ['33612345680', '33612345682', '33612345683', '32470123456'].every((n) => nums.includes(n)), nums.join(','));
  ok('U4 message : « du Bal des Fous »', liens.length && liens.every((h) => h.includes('du Bal des Fous') && !h.includes('du Le Bal')));
  await p.close(); await b.close(); srv.kill('SIGTERM');

  const ko = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - ko}/${res.length} vérifications d'interface conformes`);
  process.exit(ko ? 1 : 0);
})();
