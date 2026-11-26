// =====================================================================
//  CONFIGURATION DE L'ÉVÉNEMENT — tout ce qui se modifie est ici.
//  (le serveur lit aussi ce fichier pour connaître les tables)
// =====================================================================
import { LOUNGES, BOOTHS, BANQUETTES } from './plan.js';

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
  fin: '2026-12-28T00:00:00+01:00',
  urlPublique: 'https://bal-noel-mgh6.onrender.com',
  conservationJours: 90,             // les demandes sont effacées 90 jours après la soirée
  personnes: 'prix par personne',
};

// Zones : nom, prix (nombre ou [min, max]), capacité, couleur de la pastille
// ---------------------------------------------------------------------------
// VIP CROISETTE : 4 zones, chacune avec une ligne avant et une ligne arrière.
// Le client réserve une LIGNE (pas une table) et indique le nombre de personnes ;
// l'organisation attribue ensuite les tables depuis l'administration.
// ---------------------------------------------------------------------------
// Informations légales : À COMPLÉTER par l'organisateur (affichées dans les mentions légales)
export const EDITEUR = {
  societe: 'SAS LE BAL DES FOUS',
  adresse: 'à compléter',
  siret: 'à compléter',
  directeurPublication: 'à compléter',
  email: 'à compléter',
  telephone: 'à compléter',
};
export const HEBERGEUR = 'Render Services, Inc. — 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis — render.com';

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

// Tables : relevées sur le plan Deco Flamme (voir plan.js, coordonnées en mètres autour de la piste).
// Chaque salon = une banquette + ses tables ; une ligne (avant / arrière) regroupe plusieurs salons.
// Numérotation : zone 1 → zone 4 (ligne arrière puis avant), puis la scène.
export const SALONS = [
  ...LOUNGES.map((l) => ({ ...l, type: 'salon' })),
  ...BOOTHS.map((p) => ({ ligne: 'scene', type: 'loge', tables: [p] })),
  ...BANQUETTES.map((l) => ({ ...l, type: 'salon' })),
];
const ORDRE = ['z1-ar', 'z1-av', 'z2-ar', 'z2-av', 'z3-ar', 'z3-av', 'z4-ar', 'z4-av', 'scene'];
export const TABLES = [];
ORDRE.forEach((ligne) => SALONS.forEach((s, si) => {
  if (s.ligne !== ligne) return;
  s.tables.forEach(([x, y]) => TABLES.push({ id: String(TABLES.length + 1).padStart(2, '0'), zone: ligne, x, y, salon: si, rond: s.type === 'loge' }));
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
