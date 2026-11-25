// =====================================================================
//  CONFIGURATION DE L'ÉVÉNEMENT — tout ce qui se modifie est ici.
//  (le serveur lit aussi ce fichier pour connaître les tables)
// =====================================================================

export const EVENT = {
  marque: 'Le Bal des Fous',
  theme: 'Le Bal de Noël',
  sousTheme: 'Édition Noël',
  dateLongue: 'Dimanche 27 décembre',
  dateCourte: '27 DÉCEMBRE 2026',
  horaires: '16H00 — MINUIT',
  horairesFr: '16 h — minuit',
  debut: '2026-12-27T16:00:00+01:00',   // pour le compte à rebours
  lieu: 'Palais des Festivals · Cannes',
  lieuDetail: 'Les Terrasses, Palais des Festivals, Cannes',
  tagline: 'LE BAL DE NOËL · CANNES',
  acomptePct: 20,
  personnes: '10 ou 15 personnes',
};

// Zones : nom, prix (nombre ou [min, max]), capacité, couleur de la pastille
export const ZONES = [
  { id: 'front',   desc: 'face au DJ, au cœur de la scène', nom: 'Scène · Front DJ',       prix: 3500,         capacite: 15, couleurs: ['#e9d3a0'] },
  { id: 'diag',    desc: 'en arc autour du DJ, sur la scène', nom: 'Scène · Diagonales',     prix: [2000, 2500], capacite: 10, couleurs: ['#c9a45c', '#9fbf98'] },
  { id: 'balcon',  desc: 'surélevée, juste à côté du DJ', nom: 'Scène · Balcons +0,60',  prix: 1800,         capacite: 10, couleurs: ['#b8a3d9'] },
  { id: 'fond1',   desc: 'premier rang, vue directe sur la piste', nom: 'VIP Fond · rang 1',      prix: 2000,         capacite: 15, couleurs: ['#e0997a'] },
  { id: 'fond2',   desc: 'second rang, en surplomb de la salle', nom: 'VIP Fond · rang 2',      prix: 1500,         capacite: 10, couleurs: ['#d0829a'] },
  { id: 'ailes',   desc: 'sur le côté, vue en diagonale sur la piste', nom: 'VIP Fond · ailes',       prix: 1200,         capacite: 10, couleurs: ['#93bccf'] },
];

// Tables : une table = un petit carré blanc devant la banquette sur le plan.
// Chaque rangée : zone, orientation de la banquette (degrés, 0 = banquette au nord / au fond),
// et le centre de chaque table relevé sur le plan (pixels du plan 1280 × 834, 17 px ≈ 1 m).
// La piste tournante est au centre (627, 389). Les tables sont numérotées dans l'ordre des rangées.
export const ROWS = [
  // VIP Fond — rang du fond (gauche puis droite)
  { zone: 'fond2', rot: 0, pts: [[539, 197], [555, 197], [571, 197], [588, 197]] },
  { zone: 'fond2', rot: 0, pts: [[664, 197], [680, 197], [697, 197], [713, 197]] },
  // VIP Fond — rang côté piste
  { zone: 'fond1', rot: 0, pts: [[479, 240], [496, 240], [512, 240], [528, 240], [545, 240], [561, 240]] },
  { zone: 'fond1', rot: 0, pts: [[690, 240], [707, 240], [723, 240], [739, 240], [756, 240], [772, 240]] },
  // Aile gauche (rangée contre la vitre, puis rangée intérieure)
  { zone: 'ailes', rot: 35.6, pts: [[332, 322.5], [345.5, 313], [358.8, 303.3], [372, 294], [385, 284.3], [398.8, 275]] },
  { zone: 'ailes', rot: 35.6, pts: [[366.3, 350], [379.5, 340.8], [393, 331.3], [406.3, 321.8], [419.5, 312.5], [433, 303.3]] },
  // Aile droite
  { zone: 'ailes', rot: -35.6, pts: [[854, 274.5], [867, 284.3], [880.5, 294], [893.8, 303.8], [907, 313.3], [920.5, 322.5]] },
  { zone: 'ailes', rot: -35.6, pts: [[819.5, 302.5], [832.5, 312], [845.8, 321.3], [859.3, 330.5], [872.5, 340.5], [886, 350]] },
  // Scène — balcons +0,60 de part et d'autre du DJ
  { zone: 'balcon', rot: 180, pts: [[492.3, 575], [508.3, 575]] },
  { zone: 'balcon', rot: 180, pts: [[750, 575], [766, 575]] },
  // Scène — face au DJ
  { zone: 'front', rot: 180, pts: [[588.3, 609], [604.3, 609], [620.3, 609], [637.3, 609], [653.3, 609], [669.7, 609]] },
  // Scène — diagonales (les 2 plus proches du DJ à 2 500 €)
  { zone: 'diag', rot: 145.2, pts: [[540, 626.7], [554.3, 635], [568, 644], [581.7, 653.3], [595.3, 662]], prix: [2500, 2500, 2000, 2000, 2000] },
  { zone: 'diag', rot: -145.2, pts: [[662.7, 662], [676, 653.3], [690, 644], [704, 635], [717.7, 626.7]], prix: [2000, 2000, 2000, 2500, 2500] },
];

export const TABLES = [];
ROWS.forEach((r, ri) => r.pts.forEach(([x, y], k) => {
  TABLES.push({ id: String(TABLES.length + 1).padStart(2, '0'), zone: r.zone, x, y, rot: r.rot, row: ri, prix: r.prix ? r.prix[k] : undefined });
}));

export const zoneOf = (t) => ZONES.find((z) => z.id === t.zone);
export const prixTable = (t) => t.prix ?? (Array.isArray(zoneOf(t).prix) ? zoneOf(t).prix[0] : zoneOf(t).prix);
export const euros = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ') + ' €';
