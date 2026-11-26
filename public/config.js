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
  horairesFr: 'Ouverture des portes à 16 h · Fermeture à minuit',
  debut: '2026-12-27T16:00:00+01:00',   // pour le compte à rebours
  lieu: 'Palais des Festivals · Cannes',
  lieuDetail: 'La Terrasse du Palais des Festivals, Cannes',
  tagline: 'LE BAL DE NOËL · CANNES',
  acomptePct: 20,
  personnes: 'prix par personne',
};

// Zones : nom, prix (nombre ou [min, max]), capacité, couleur de la pastille
// ---------------------------------------------------------------------------
// VIP CROISETTE : 4 zones, chacune avec une ligne avant et une ligne arrière.
// Le client réserve une LIGNE (pas une table) et indique le nombre de personnes ;
// l'organisation attribue ensuite les tables depuis l'administration.
// ---------------------------------------------------------------------------
export const VIP_NOM = 'VIP Croisette';
export const PERS_PAR_TABLE = 6;      // PROVISOIRE : sert à calculer les places de chaque ligne
export const MAX_PAR_DEMANDE = 30;    // nombre maximum de personnes dans une seule demande

export const GROUPES = [
  { id: 'z1', num: 1, nom: 'Zone 1', desc: 'aile gauche, le long de la vitre' },
  { id: 'z2', num: 2, nom: 'Zone 2', desc: 'face au DJ, côté gauche' },
  { id: 'z3', num: 3, nom: 'Zone 3', desc: 'face au DJ, côté droit' },
  { id: 'z4', num: 4, nom: 'Zone 4', desc: 'aile droite, le long de la vitre' },
  { id: 'scene', num: null, nom: 'Scène', desc: 'autour du DJ', bientot: true },
];
const AVANT = { type: 'avant', libelle: 'Ligne avant', prixPers: 200, enVente: true, couleurs: ['#f2b84b'] };
const ARRIERE = { type: 'arriere', libelle: 'Ligne arrière', prixPers: 150, enVente: true, couleurs: ['#8fb8dc'] };
// « ZONES » = lignes réservables (le nom est conservé pour le reste du code)
export const ZONES = [
  { id: 'z1-av', groupe: 'z1', ...AVANT }, { id: 'z1-ar', groupe: 'z1', ...ARRIERE },
  { id: 'z2-av', groupe: 'z2', ...AVANT }, { id: 'z2-ar', groupe: 'z2', ...ARRIERE },
  { id: 'z3-av', groupe: 'z3', ...AVANT }, { id: 'z3-ar', groupe: 'z3', ...ARRIERE },
  { id: 'z4-av', groupe: 'z4', ...AVANT }, { id: 'z4-ar', groupe: 'z4', ...ARRIERE },
  { id: 'scene', groupe: 'scene', type: 'scene', libelle: 'Scène', prixPers: null, enVente: false, couleurs: ['#4b5670'] },
];
ZONES.forEach((l) => { const g = GROUPES.find((x) => x.id === l.groupe); l.nom = l.type === 'scene' ? 'Scène · autour du DJ' : `${g.nom} · ${l.libelle}`; l.desc = g.desc; });

// Tables : une table = un petit carré blanc devant la banquette sur le plan.
// Chaque rangée : zone, orientation de la banquette (degrés, 0 = banquette au nord / au fond),
// et le centre de chaque table relevé sur le plan (pixels du plan 1280 × 834, 17 px ≈ 1 m).
// La piste tournante est au centre (627, 389). Les tables sont numérotées dans l'ordre des rangées.
export const ROWS = [
  // VIP Fond — rang du fond (gauche puis droite)
  { zone: 'z2-ar', rot: 0, pts: [[539, 197], [555, 197], [571, 197], [588, 197]] },
  { zone: 'z3-ar', rot: 0, pts: [[664, 197], [680, 197], [697, 197], [713, 197]] },
  // VIP Fond — rang côté piste
  { zone: 'z2-av', rot: 0, pts: [[479, 240], [496, 240], [512, 240], [528, 240], [545, 240], [561, 240]] },
  { zone: 'z3-av', rot: 0, pts: [[690, 240], [707, 240], [723, 240], [739, 240], [756, 240], [772, 240]] },
  // Aile gauche (rangée contre la vitre, puis rangée intérieure)
  { zone: 'z1-ar', rot: 35.6, pts: [[332, 322.5], [345.5, 313], [358.8, 303.3], [372, 294], [385, 284.3], [398.8, 275]] },
  { zone: 'z1-av', rot: 35.6, pts: [[366.3, 350], [379.5, 340.8], [393, 331.3], [406.3, 321.8], [419.5, 312.5], [433, 303.3]] },
  // Aile droite
  { zone: 'z4-ar', rot: -35.6, pts: [[854, 274.5], [867, 284.3], [880.5, 294], [893.8, 303.8], [907, 313.3], [920.5, 322.5]] },
  { zone: 'z4-av', rot: -35.6, pts: [[819.5, 302.5], [832.5, 312], [845.8, 321.3], [859.3, 330.5], [872.5, 340.5], [886, 350]] },
  // Scène — balcons +0,60 de part et d'autre du DJ
  { zone: 'scene', rot: 180, pts: [[492.3, 575], [508.3, 575]] },
  { zone: 'scene', rot: 180, pts: [[750, 575], [766, 575]] },
  // Scène — face au DJ
  { zone: 'scene', rot: 180, pts: [[588.3, 609], [604.3, 609], [620.3, 609], [637.3, 609], [653.3, 609], [669.7, 609]] },
  // Scène — diagonales (les 2 plus proches du DJ à 2 500 €)
  { zone: 'scene', rot: 145.2, pts: [[540, 626.7], [554.3, 635], [568, 644], [581.7, 653.3], [595.3, 662]] },
  { zone: 'scene', rot: -145.2, pts: [[662.7, 662], [676, 653.3], [690, 644], [704, 635], [717.7, 626.7]] },
];

export const TABLES = [];
ROWS.forEach((r, ri) => r.pts.forEach(([x, y], k) => {
  TABLES.push({ id: String(TABLES.length + 1).padStart(2, '0'), zone: r.zone, x, y, rot: r.rot, row: ri });
}));

export const zoneOf = (t) => ZONES.find((z) => z.id === t.zone);   // ligne d'une table
export const ligneById = (id) => ZONES.find((z) => z.id === id);
export const groupeOf = (l) => GROUPES.find((g) => g.id === l.groupe);
export const tablesDe = (ligneId) => TABLES.filter((t) => t.zone === ligneId);
export const placesDe = (ligneId) => tablesDe(ligneId).length * PERS_PAR_TABLE;
export const enVente = (t) => zoneOf(t).enVente;
export const prixPers = (t) => zoneOf(t).prixPers;
export const totalLigne = (l, n) => (l.prixPers || 0) * n;
export const acompteLigne = (l, n) => Math.round(totalLigne(l, n) * EVENT.acomptePct / 100);
export const prixLabel = (l) => (l.enVente ? `${l.prixPers} € / pers.` : 'Bientôt disponible');
export const euros = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' €';
