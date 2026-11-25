// 1 000 parcours clients SIMULÉS dans un vrai navigateur (Chromium + Playwright),
// sur un serveur de test local (données de test, jamais le site en ligne).
// Chaque profil combine : appareil × réseau × comportement × préférences.
// Le résultat de chaque parcours est vérifié par une source indépendante du navigateur :
// relecture des demandes via l'API d'administration (ce que l'organisateur verra réellement).
//
//   node tests/parcours.cjs [nombre=1000] [parallèle=6]
// Rapport : tests/rapport-parcours.json et tests/rapport-parcours.md
// ⚠ Ce sont des simulations automatisées, pas des tests avec de vraies personnes.
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const N = Number(process.argv[2] || 1000), PAR = Number(process.argv[3] || 6);
const ROOT = path.resolve(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bal-noel-parcours-'));
const PORT = 4100 + Math.floor(Math.random() * 100), BASE = `http://127.0.0.1:${PORT}`, PW = 'parcours-test-password';

// générateur pseudo-aléatoire reproductible
let seed = 20261227; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const APPAREILS = [
  ['iPhone SE', devices['iPhone SE']], ['iPhone 13', devices['iPhone 13']], ['iPhone 15 Pro Max', devices['iPhone 15 Pro Max']],
  ['Pixel 7', devices['Pixel 7']], ['Galaxy S9+', devices['Galaxy S9+']], ['iPad', devices['iPad (gen 7)']],
  ['iPhone paysage', devices['iPhone 13 landscape']], ['Ordinateur 1440', { viewport: { width: 1440, height: 900 } }],
  ['Ordinateur 1920', { viewport: { width: 1920, height: 1080 } }], ['Petit portable 1280', { viewport: { width: 1280, height: 720 } }],
];
const RESEAUX = { rapide: null, '4G': { latency: 60, down: 4e6 / 8, up: 1e6 / 8 }, '3G lente': { latency: 400, down: 400e3 / 8, up: 400e3 / 8 } };
const COMPORTEMENTS = [
  'direct',          // choisit une table et envoie
  'zones',           // explore les zones puis réserve
  'liste',           // choisit dans la liste sous le plan
  'erreurs',         // fait des erreurs de saisie, lit les messages, corrige
  'double-clic',     // clique deux fois sur « envoyer »
  'retour',          // revient à l'accueil avec le bouton retour puis recommence
  'actualise',       // actualise la page en plein parcours
  'reservee',        // tombe sur une table déjà réservée
  'clavier',         // navigue uniquement au clavier
  'vue-table',       // regarde « depuis la table » puis réserve
  'filtre',          // coche « disponibles uniquement »
  'hesitant',        // ouvre plusieurs tables, ferme, change d'avis
  'abandon',         // ouvre le formulaire puis ferme sans envoyer (aucune demande ne doit être créée)
  'lien-direct',     // arrive directement sur /#plan (lien partagé)
  'mouvement-reduit',// préférence « réduire les animations »
];

function profils(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [appareil, dev] = APPAREILS[i % APPAREILS.length];
    out.push({ id: i + 1, appareil, dev, comportement: COMPORTEMENTS[Math.floor(i / APPAREILS.length) % COMPORTEMENTS.length],
      reseau: pick(['rapide', 'rapide', '4G', '3G lente']), sombre: rnd() < .3, rapide: rnd() < .4, ip: `100.${64 + (i >> 16)}.${(i >> 8) & 255}.${i & 255}` });
  }
  return out;
}

const RESERVEES = ['03', '17', '30', '51'];
async function adminData() { return (await fetch(BASE + '/api/admin/data', { headers: { 'x-admin-password': PW, 'x-forwarded-for': '127.9.9.9' } })).json(); }

async function parcours(browser, p) {
  const t0 = Date.now(), log = [], steps = { clics: 0 }, consoleErr = [];
  const ctx = await browser.newContext({ ...p.dev, colorScheme: p.sombre ? 'dark' : 'light', reducedMotion: p.comportement === 'mouvement-reduit' ? 'reduce' : 'no-preference' });
  // adresse du visiteur simulée, uniquement vers le site testé (pas vers les polices Google)
  await ctx.route(BASE + '/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': p.ip } }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErr.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && consoleErr.push(m.text()));
  if (RESEAUX[p.reseau]) { const c = await ctx.newCDPSession(page); await c.send('Network.emulateNetworkConditions', { offline: false, latency: RESEAUX[p.reseau].latency, downloadThroughput: RESEAUX[p.reseau].down, uploadThroughput: RESEAUX[p.reseau].up }); }
  const tel = `06 ${String(10 + (p.id % 89)).padStart(2, '0')} ${String(p.id).padStart(4, '0').replace(/(..)(..)/, '$1 $2')} 1${p.id % 10}`;
  const prenom = `Profil${p.id}`;
  let attendu = 'demande', table = null;
  const click = async (sel, opts) => { steps.clics++; await page.click(sel, { timeout: 15000, ...opts }); };
  const choisirTable = async (id) => { steps.clics++; await page.locator(`.tlabel[title^="Table ${id} "]`).dispatchEvent('click'); await page.waitForTimeout(p.rapide ? 700 : 1400); table = id; };
  const remplir = async () => {
    await page.fill('[name=prenom]', prenom); await page.fill('[name=nom]', 'Test');
    await page.fill('[name=tel]', tel); await page.check('[name=cgv]'); steps.clics += 4;
  };
  const libre = () => String(1 + (p.id * 7) % 64).padStart(2, '0');
  let tid = libre(); while (RESERVEES.includes(tid)) tid = String((Number(tid) % 64) + 1).padStart(2, '0');
  try {
    const t1 = Date.now();
    await page.goto(BASE + (p.comportement === 'lien-direct' ? '/#plan' : '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (p.comportement !== 'lien-direct') {
      await page.waitForSelector('#cta-main:not(.loading)', { timeout: 60000 });
      await page.waitForFunction(() => !document.querySelector('#intro') || document.querySelector('#intro').hidden || getComputedStyle(document.querySelector('#intro')).display === 'none' || document.documentElement.classList.contains('quick'), null, { timeout: 8000 }).catch(() => {});
      log.push(['accueil prêt', Date.now() - t1]);
      // le plan ne doit PAS être visible avant le clic
      if (await page.isVisible('#stage')) throw new Error('le plan est visible sur l’accueil');
      if (p.comportement === 'clavier') { await page.focus('#cta-main'); await page.keyboard.press('Enter'); steps.clics++; }
      else await click('#cta-main');
    }
    await page.waitForSelector('#stage', { state: 'visible', timeout: 20000 });
    await page.waitForTimeout(p.rapide ? 900 : 1800);
    log.push(['plan visible', Date.now() - t1]);

    switch (p.comportement) {
      case 'zones': { steps.clics++; await page.locator('.zone').nth(1 + (p.id % 6)).click(); await page.waitForTimeout(1200);
        const first = await page.locator('.zs-card:not(.taken)').first().getAttribute('data-id'); tid = first; await choisirTable(tid); break; }
      case 'liste': { steps.clics++; await page.locator('.zone').nth(4).click(); await page.waitForTimeout(1000);
        tid = await page.locator('.zs-card:not(.taken)').nth(p.id % 4).getAttribute('data-id'); steps.clics++; await page.locator(`.zs-card[data-id="${tid}"]`).click(); await page.waitForTimeout(1200); table = tid; break; }
      case 'reservee': { await choisirTable(pick(RESERVEES)); attendu = 'refus'; break; }
      case 'filtre': { steps.clics++; await page.check('#only-free'); const hidden = await page.locator('.tlabel.hide').count(); if (hidden !== RESERVEES.length) throw new Error(`filtre : ${hidden} tables masquées au lieu de ${RESERVEES.length}`); await choisirTable(tid); break; }
      case 'hesitant': { for (const x of ['08', '25', '49']) { await choisirTable(x); await click('#tp-close'); await page.waitForTimeout(400); } await choisirTable(tid); break; }
      case 'vue-table': { await choisirTable(tid); await click('#tp-pov'); await page.waitForTimeout(1600); if (!(await page.isVisible('#pov-bar'))) throw new Error('vue depuis la table absente'); await click('#pov-exit'); await page.waitForTimeout(1200); break; }
      default: await choisirTable(tid);
    }
    if (!(await page.isVisible('#tpanel'))) throw new Error('la fiche de la table ne s’ouvre pas');
    const prix = await page.textContent('#tp-price'); if (!/€/.test(prix)) throw new Error('prix absent');
    if (attendu === 'refus') {
      if (!(await page.isDisabled('#tp-ask'))) throw new Error('une table réservée peut être demandée');
      return { ok: true, attendu, table, duree: Date.now() - t0, log, steps, consoleErr };
    }
    // ouvrir le formulaire
    if (p.comportement === 'clavier') { await page.focus('#tp-ask'); await page.keyboard.press('Enter'); steps.clics++; } else await click('#tp-ask');
    await page.waitForSelector('#drawer.open', { timeout: 5000 }); await page.waitForTimeout(450);

    if (p.comportement === 'abandon') { await page.fill('[name=prenom]', prenom); await page.keyboard.press('Escape'); attendu = 'aucune';
      await page.waitForTimeout(300); if (await page.isVisible('#drawer.open')) throw new Error('Échap ne ferme pas le formulaire');
      return { ok: true, attendu, table, duree: Date.now() - t0, log, steps, consoleErr, tel }; }
    if (p.comportement === 'erreurs') {
      await click('#d-submit'); const e1 = await page.textContent('#d-error'); if (!/prénom/.test(e1)) throw new Error('message d’erreur vide/incompréhensible : ' + e1);
      await page.fill('[name=prenom]', prenom); await page.fill('[name=nom]', 'Test'); await page.fill('[name=tel]', '12'); await page.fill('[name=email]', 'pas-un-mail');
      await click('#d-submit'); const e2 = await page.textContent('#d-error'); if (!/téléphone/.test(e2) || !/e-mail/.test(e2) || !/acompte/.test(e2)) throw new Error('erreurs non signalées : ' + e2);
      await page.fill('[name=email]', '');
    }
    if (p.comportement === 'actualise') { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => { const v = (e) => e && e.offsetParent !== null; return v(document.querySelector('#stage')) || (v(document.querySelector('#cta-main')) && !document.querySelector('#cta-main').classList.contains('loading')); }, null, { timeout: 60000 });
      if (await page.isVisible('#cta-main')) await click('#cta-main'); await page.waitForSelector('#stage', { state: 'visible' }); await page.waitForTimeout(1500);
      await choisirTable(tid); await click('#tp-ask'); await page.waitForSelector('#drawer.open'); await page.waitForTimeout(450); }
    if (p.comportement === 'retour') { await page.keyboard.press('Escape'); await page.goBack(); await page.waitForTimeout(800);
      if (!(await page.isVisible('#cta-main'))) throw new Error('le retour ne ramène pas à l’accueil');
      await click('#cta-main'); await page.waitForSelector('#stage', { state: 'visible' }); await page.waitForTimeout(1500);
      await choisirTable(tid); await click('#tp-ask'); await page.waitForSelector('#drawer.open'); await page.waitForTimeout(450); }
    await remplir();
    if (p.comportement === 'clavier') { await page.focus('#d-submit'); await page.keyboard.press('Enter'); }
    else if (p.comportement === 'double-clic') { await page.dblclick('#d-submit'); }
    else await click('#d-submit');
    await page.waitForSelector('#d-ok-view:not([hidden])', { timeout: 20000 });
    const txt = await page.textContent('#d-ok-text');
    if (!txt.includes(`table ${table}`)) throw new Error('confirmation incohérente : ' + txt.slice(0, 80));
    return { ok: true, attendu, table, duree: Date.now() - t0, log, steps, consoleErr, tel, prenom };
  } catch (e) {
    const shot = path.join(__dirname, 'echecs', `p${p.id}.png`); fs.mkdirSync(path.dirname(shot), { recursive: true });
    await page.screenshot({ path: shot }).catch(() => {});
    const detail = e.message.split('\n').filter((l) => /intercepts|not visible|not stable|outside of the viewport|waiting for locator|waiting for selector/.test(l)).slice(-2).join(' / ');
    return { ok: false, erreur: e.message.split('\n')[0] + (detail ? ' — ' + detail.trim() : ''), attendu, table, duree: Date.now() - t0, log, steps, consoleErr, tel, capture: path.relative(ROOT, shot) };
  } finally { await ctx.close(); }
}

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: PW, RENDER: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/health'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  for (const id of RESERVEES) await fetch(BASE + '/api/admin/table', { method: 'POST', headers: { 'x-admin-password': PW, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reserved: true }) });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  // IDS=3,17,42 : rejouer uniquement certains profils (même appareil/réseau/comportement)
  let list = profils(N); if (process.env.IDS) { const keep = new Set(process.env.IDS.split(',').map(Number)); list = list.filter((p) => keep.has(p.id)); }
  const res = new Array(list.length); let next = 0, done = 0; const T = Date.now();
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (next < list.length) { const i = next++; res[i] = { ...list[i], dev: undefined, ...(await parcours(browser, list[i])) }; done++;
      if (done % 25 === 0) process.stdout.write(`${done}/${list.length} · ${res.filter(Boolean).filter((r) => !r.ok).length} échecs · ${Math.round((Date.now() - T) / 1000)} s\n`); }
  }));
  await browser.close();

  // VÉRIFICATION INDÉPENDANTE : ce que l'organisateur voit réellement dans l'admin
  const data = await adminData();
  for (const r of res) {
    const mine = data.demandes.filter((d) => d.tel === r.tel);
    if (r.ok && r.attendu === 'demande') {
      if (mine.length !== 1) { r.ok = false; r.erreur = `vérification admin : ${mine.length} demande(s) au lieu de 1`; }
      else if (mine[0].table !== r.table) { r.ok = false; r.erreur = `vérification admin : table ${mine[0].table} au lieu de ${r.table}`; }
    }
    if (r.attendu !== 'demande' && mine.length) { r.ok = false; r.erreur = `vérification admin : demande créée alors qu’aucune n’était attendue`; }
    if (r.ok && r.consoleErr.length) { r.ok = false; r.erreur = 'erreur JavaScript : ' + r.consoleErr[0]; }
  }
  srv.kill('SIGTERM');

  const by = (k) => Object.entries(res.reduce((a, r) => { (a[r[k]] ||= { n: 0, ok: 0, duree: 0 }); a[r[k]].n++; a[r[k]].ok += r.ok; a[r[k]].duree += r.duree; return a; }, {}));
  const ok = res.filter((r) => r.ok).length;
  const lines = [`# Rapport des ${res.length} parcours simulés`, '', `Exécuté le ${new Date().toISOString()} sur un serveur de test local (données de test). **Simulations automatisées, pas des personnes réelles.**`, '',
    `**Réussite : ${ok}/${res.length} (${(ok / res.length * 100).toFixed(1)} %)** · vérification indépendante via l’administration · durée totale ${Math.round((Date.now() - T) / 1000)} s`, '',
    '| Comportement | Parcours | Réussis | Durée moyenne |', '|---|---|---|---|', ...by('comportement').map(([k, v]) => `| ${k} | ${v.n} | ${v.ok} | ${(v.duree / v.n / 1000).toFixed(1)} s |`), '',
    '| Appareil | Parcours | Réussis | Durée moyenne |', '|---|---|---|---|', ...by('appareil').map(([k, v]) => `| ${k} | ${v.n} | ${v.ok} | ${(v.duree / v.n / 1000).toFixed(1)} s |`), '',
    '| Réseau | Parcours | Réussis | Durée moyenne |', '|---|---|---|---|', ...by('reseau').map(([k, v]) => `| ${k} | ${v.n} | ${v.ok} | ${(v.duree / v.n / 1000).toFixed(1)} s |`), '',
    '## Échecs', '', ...(res.filter((r) => !r.ok).map((r) => `- #${r.id} ${r.appareil} · ${r.reseau} · ${r.comportement} : ${r.erreur}${r.capture ? ` (${r.capture})` : ''}`)), ok === res.length ? '_Aucun._' : ''];
  fs.writeFileSync(path.join(__dirname, 'rapport-parcours.md'), lines.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'rapport-parcours.json'), JSON.stringify(res, null, 1));
  console.log(lines.slice(0, 6).join('\n'));
  process.exit(ok === res.length ? 0 : 1);
})();
